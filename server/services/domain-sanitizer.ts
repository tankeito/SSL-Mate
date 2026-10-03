/**
 * Domain Sanitizer & Validator for SSL-Mate
 * Ensures domain names strictly conform to RFC 1035 / ACME RFC 8555 specifications.
 */

/**
 * Clean and normalize a domain string:
 * - Strips protocol (http://, https://, ftp://, etc.)
 * - Strips basic auth (user:pass@)
 * - Strips paths (/path, /)
 * - Strips port (:443, :8080)
 * - Trims whitespace and converts to lowercase
 * - Strips leading/trailing dots or slashes
 */
export function sanitizeDomain(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let domain = input.trim().toLowerCase();

  // 1. Strip protocol: https://, http://, etc.
  domain = domain.replace(/^[a-zA-Z]+:\/\//, '');

  // 2. Strip credentials if any: user:pass@
  if (domain.includes('@')) {
    domain = domain.split('@').pop() || '';
  }

  // 3. Strip paths and query parameters: /path, ?query, #hash
  domain = domain.split(/[\/\?\#]/)[0];

  // 4. Strip port: :443 or :8080 (unless IPv6 [::1])
  if (!domain.startsWith('[')) {
    domain = domain.split(':')[0];
  }

  // 5. Trim leading/trailing dots, asterisks or spaces that are malformed
  // Keep valid wildcard prefix (*.)
  const isWildcard = domain.startsWith('*.');
  if (isWildcard) {
    domain = domain.slice(2);
  }

  domain = domain.replace(/^[\.\s\/\\]+|[\.\s\/\\]+$/g, '');

  if (isWildcard && domain) {
    domain = `*.${domain}`;
  }

  return domain;
}

/**
 * Validate whether a sanitized domain conforms to RFC standards for ACME SSL issuance:
 * - Supports FQDN (e.g., key.btc354.com, example.com)
 * - Supports Wildcard (e.g., *.btc354.com)
 * - Labels can only contain [a-z0-9-] and cannot start or end with hyphen
 * - Cannot contain invalid URL characters (/, :, @, etc.)
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;

  let testDomain = domain;
  if (testDomain.startsWith('*.')) {
    testDomain = testDomain.slice(2);
  }

  // No double wildcards or internal wildcards
  if (!testDomain || testDomain.includes('*')) return false;

  const labels = testDomain.split('.');
  // ACME public certificates require at least 2 labels (SLD + TLD), e.g. domain.com
  if (labels.length < 2) return false;

  const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return labels.every(label => labelRegex.test(label));
}
