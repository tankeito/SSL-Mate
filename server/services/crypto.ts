import crypto from 'crypto';
import { config } from '../config.js';

// Derive 32-byte key from masterKey
const KEY = crypto.createHash('sha256').update(config.masterKey).digest();

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns formatted string: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // Return as is if not encrypted format
      return encryptedText;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return '';
  }
}

/**
 * Encrypt arbitrary JSON object
 */
export function encryptObject<T = any>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt JSON object
 */
export function decryptObject<T = any>(encryptedText: string, fallback: T = {} as T): T {
  if (!encryptedText) return fallback;
  try {
    const jsonStr = decrypt(encryptedText);
    if (!jsonStr) return fallback;
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    return fallback;
  }
}

/**
 * Mask sensitive string for display in UI (e.g. "sk-12345678" -> "sk-12****78")
 */
export function maskSecret(val: string): string {
  if (!val || typeof val !== 'string') return '';
  if (val.length <= 8) return '******';
  return val.slice(0, 4) + '****' + val.slice(-4);
}
