import crypto from 'crypto';
import { db } from '../db/database.js';
import { User } from '../db/schema.js';

export interface OIDCConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

let cachedOIDCConfig: OIDCConfiguration | null = null;
let lastConfigFetchTime = 0;

export function clearOIDCDiscoveryCache() {
  cachedOIDCConfig = null;
  lastConfigFetchTime = 0;
}

/**
 * Fetch OIDC Discovery document from AuthMate IdP
 */
export async function getOIDCDiscoveryConfig(): Promise<OIDCConfiguration> {
  const settings = db.getSettings().authmate;
  const now = Date.now();

  if (cachedOIDCConfig && (now - lastConfigFetchTime < 300000)) { // Cache for 5 mins
    return cachedOIDCConfig;
  }

  const base = settings.issuerUrl.replace(/\/+$/, '');
  const discoveryUrl = `${base}/.well-known/openid-configuration`;

  try {
    const res = await fetch(discoveryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`Discovery endpoint returned HTTP ${res.status}`);
    }

    const config = await res.json() as OIDCConfiguration;
    cachedOIDCConfig = config;
    lastConfigFetchTime = now;
    return config;
  } catch (err) {
    // Fallback if discovery fails or IdP is custom
    console.warn(`Failed to fetch discovery from ${discoveryUrl}, using standard endpoints fallback. Error:`, (err as any).message);
    const fallbackConfig: OIDCConfiguration = {
      issuer: base,
      authorization_endpoint: `${base}/oauth2/authorize`,
      token_endpoint: `${base}/oauth2/token`,
      userinfo_endpoint: `${base}/oauth2/userinfo`,
      jwks_uri: `${base}/jwks.json`
    };
    cachedOIDCConfig = fallbackConfig;
    return fallbackConfig;
  }
}

/**
 * Generate PKCE S256 Code Verifier and Code Challenge
 */
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * Build the AuthMate SSO Authorization URL for user redirect
 */
export async function buildSSOAuthorizationUrl(state: string, codeChallenge: string): Promise<string> {
  const settings = db.getSettings().authmate;
  const discovery = await getOIDCDiscoveryConfig();

  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', settings.clientId);
  authUrl.searchParams.set('redirect_uri', settings.redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return authUrl.toString();
}

/**
 * Exchange Authorization Code for Tokens at AuthMate Token Endpoint
 */
export async function exchangeCodeForTokens(code: string, codeVerifier?: string) {
  const settings = db.getSettings().authmate;
  const discovery = await getOIDCDiscoveryConfig();

  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('client_id', settings.clientId);
  if (settings.clientSecret) {
    params.set('client_secret', settings.clientSecret);
  }
  params.set('code', code);
  params.set('redirect_uri', settings.redirectUri);
  if (codeVerifier) {
    params.set('code_verifier', codeVerifier);
  }

  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${errorText}`);
  }

  const tokens = await res.json();
  return tokens as {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in?: number;
  };
}

/**
 * Fetch User Profile from AuthMate UserInfo Endpoint
 */
export async function fetchUserInfo(accessToken: string) {
  const discovery = await getOIDCDiscoveryConfig();

  const res = await fetch(discovery.userinfo_endpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!res.ok) {
    throw new Error(`UserInfo fetch failed (HTTP ${res.status})`);
  }

  return await res.json() as {
    sub: string;
    email: string;
    name?: string;
    preferred_username?: string;
    picture?: string;
    roles?: string[];
  };
}

/**
 * Provision or Map local user based on AuthMate profile
 */
export function provisionSSOUser(profile: {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  roles?: string[];
}): User {
  const email = profile.email || `${profile.sub}@authmate.local`;
  const username = profile.preferred_username || profile.name || email.split('@')[0] || `user_${profile.sub.slice(0, 6)}`;

  // Find by SSO sub first
  let user = db.findUserBySsoSub(profile.sub);

  // If not found, find by email
  if (!user) {
    user = db.findUserByEmail(email);
  }

  const now = new Date().toISOString();

  if (user) {
    // Update existing user
    user.ssoSub = profile.sub;
    user.authSource = 'authmate';
    user.lastLoginAt = now;
    if (profile.picture) user.avatarUrl = profile.picture;
    db.upsertUser(user);
    return user;
  }

  // Check if first user in system
  const allUsers = db.getUsers();
  const role = allUsers.length <= 1 ? 'admin' : 'operator';

  // Create new user
  const newUser: User = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    username,
    email,
    authSource: 'authmate',
    ssoSub: profile.sub,
    role,
    avatarUrl: profile.picture || '',
    isActive: true,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now
  };

  db.upsertUser(newUser);
  return newUser;
}
