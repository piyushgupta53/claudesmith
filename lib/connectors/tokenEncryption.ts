/**
 * Token Encryption Utilities
 * AES-256-GCM encryption for OAuth tokens in localStorage
 *
 * Security considerations:
 * - Uses Web Crypto API for cryptographic operations
 * - Generates random IV for each encryption
 * - Uses AES-256-GCM for authenticated encryption
 * - Encryption key is derived from a device-specific seed
 *
 * Note: This is client-side encryption for development/local use.
 * For production, tokens should be stored server-side in a secure database.
 */

import type { OAuthTokens, EncryptedTokenPayload } from '../types/connector';

// Encryption configuration
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 128; // bits
const CURRENT_VERSION = 1;

/**
 * Get or create a device-specific encryption key seed
 * This provides basic key isolation per device
 */
function getOrCreateKeySeed(): string {
  const SEED_KEY = 'claude-agent-key-seed';

  if (typeof window === 'undefined') {
    // Server-side: token encryption requires browser environment
    // This prevents SSR from using a weak constant key
    throw new Error('Token encryption requires browser environment');
  }

  let seed = localStorage.getItem(SEED_KEY);
  if (!seed) {
    // Generate a random seed
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    seed = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SEED_KEY, seed);
  }
  return seed;
}

/**
 * Derive an encryption key from the seed
 */
async function deriveKey(): Promise<CryptoKey> {
  const seed = getOrCreateKeySeed();
  const encoder = new TextEncoder();
  const seedData = encoder.encode(seed);

  // Import the seed as a key for PBKDF2
  const baseKey = await crypto.subtle.importKey(
    'raw',
    seedData,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('claude-agent-oauth-tokens'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt OAuth tokens
 */
export async function encryptTokens(tokens: OAuthTokens): Promise<string> {
  try {
    const key = await deriveKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(tokens));

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: AUTH_TAG_LENGTH,
      },
      key,
      data
    );

    // The ciphertext includes the auth tag at the end
    const ciphertextArray = new Uint8Array(ciphertext);
    const authTagStart = ciphertextArray.length - AUTH_TAG_LENGTH / 8;
    const actualCiphertext = ciphertextArray.slice(0, authTagStart);
    const authTag = ciphertextArray.slice(authTagStart);

    // Create payload
    const payload: EncryptedTokenPayload = {
      version: CURRENT_VERSION,
      iv: arrayToBase64(iv),
      ciphertext: arrayToBase64(actualCiphertext),
      authTag: arrayToBase64(authTag),
    };

    return JSON.stringify(payload);
  } catch (error) {
    console.error('[TokenEncryption] Encryption failed:', error);
    throw new Error('Failed to encrypt tokens');
  }
}

/**
 * Decrypt OAuth tokens
 */
export async function decryptTokens(encryptedString: string): Promise<OAuthTokens> {
  try {
    const payload: EncryptedTokenPayload = JSON.parse(encryptedString);

    // Version check for future migrations
    if (payload.version !== CURRENT_VERSION) {
      throw new Error(`Unsupported encryption version: ${payload.version}`);
    }

    const key = await deriveKey();
    const iv = base64ToArray(payload.iv);
    const ciphertext = base64ToArray(payload.ciphertext);
    const authTag = base64ToArray(payload.authTag);

    // Combine ciphertext and auth tag for decryption
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext);
    combined.set(authTag, ciphertext.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as Uint8Array<ArrayBuffer>,
        tagLength: AUTH_TAG_LENGTH,
      },
      key,
      combined
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decrypted);
    return JSON.parse(jsonString) as OAuthTokens;
  } catch (error) {
    console.error('[TokenEncryption] Decryption failed:', error);
    throw new Error('Failed to decrypt tokens');
  }
}

/**
 * Check if tokens are expired or about to expire
 * @param tokens - OAuth tokens
 * @param bufferMs - Buffer time before actual expiration (default: 5 minutes)
 */
export function areTokensExpired(tokens: OAuthTokens, bufferMs: number = 5 * 60 * 1000): boolean {
  if (!tokens.expiresAt) {
    // No expiration info, assume not expired
    return false;
  }
  return Date.now() >= tokens.expiresAt - bufferMs;
}

/**
 * Check if tokens can be refreshed
 */
export function canRefreshTokens(tokens: OAuthTokens): boolean {
  return !!tokens.refreshToken;
}

/**
 * Convert Uint8Array to base64 string
 */
function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

/**
 * Generate a cryptographically secure random string
 * Used for OAuth state parameter
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a PKCE code verifier
 * Should be 43-128 characters, URL-safe
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Use URL-safe base64 encoding
  return arrayToBase64Url(array);
}

/**
 * Generate a PKCE code challenge from verifier
 * Uses SHA-256 hash with URL-safe base64 encoding
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return arrayToBase64Url(new Uint8Array(hash));
}

/**
 * Convert Uint8Array to URL-safe base64 string
 */
function arrayToBase64Url(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
