/**
 * Path Validator
 *
 * Validates file paths to prevent path traversal and unauthorized access
 * Enforces read-only vs read-write rules for different directories
 */

import path from 'path';
import { ValidationResult } from '../types/container';

/**
 * Allowed directories for read operations
 * Note: /project removed for security - agents access files via MCP servers, uploads, or WebFetch
 */
const READ_ALLOWED_DIRS = [
  '/scratch',       // Temporary workspace (read-write)
  '/skills',        // Skills directory (read-only)
  '/claude-cache'   // Claude SDK cache files (read-only) - for large tool results
];

/**
 * Allowed directories for write operations
 */
const WRITE_ALLOWED_DIRS = [
  '/scratch'   // Only /scratch is writable
];

/**
 * Blocked directories (system paths that should never be accessible)
 */
const BLOCKED_DIRS = [
  '/etc',
  '/var',
  '/sys',
  '/proc',
  '/dev',
  '/boot',
  '/root',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
  '/tmp',
  '/run'
];

/**
 * Sensitive file patterns that should NEVER be readable
 * These are blocked even within allowed directories
 */
const SENSITIVE_FILE_PATTERNS = [
  // Environment and secrets
  /\.env($|\.)/i,                    // .env, .env.local, .env.production, etc.
  /\.secret/i,                       // .secret, .secrets, secret.json, etc.
  /secret[s]?\.(json|ya?ml|toml)/i,  // secrets.json, secret.yaml, etc.
  /credential/i,                     // credentials.json, .credentials, etc.

  // Private keys and certificates
  /\.pem$/i,                         // Private keys
  /\.key$/i,                         // Private keys
  /\.p12$/i,                         // PKCS#12 files
  /\.pfx$/i,                         // Personal Information Exchange
  /id_rsa/i,                         // SSH private keys
  /id_ed25519/i,                     // SSH private keys
  /id_ecdsa/i,                       // SSH private keys

  // Git credentials
  /\.git\/config$/,                  // May contain credentials
  /\.git-credentials$/,              // Git credential store
  /\.gitconfig$/,                    // May contain tokens

  // Cloud and service credentials
  /\.aws\/credentials/i,             // AWS credentials
  /\.aws\/config/i,                  // AWS config
  /gcloud.*\.json$/i,                // Google Cloud service accounts
  /service[-_]?account.*\.json$/i,   // Service account files
  /firebase.*\.json$/i,              // Firebase config (may have API keys)

  // Package manager tokens
  /\.npmrc$/,                        // npm tokens
  /\.yarnrc$/,                       // yarn tokens
  /\.pypirc$/,                       // PyPI tokens

  // IDE and editor secrets
  /\.vscode\/settings\.json$/,       // May contain secrets
  /\.idea\/.*\.xml$/,                // IntelliJ settings

  // Database and connection strings
  /database\.(json|ya?ml|toml)/i,    // Database configs
  /connection.*\.(json|ya?ml)/i,     // Connection strings

  // Auth and tokens
  /auth.*\.(json|ya?ml|toml)/i,      // Auth configs
  /token[s]?\.(json|txt)/i,          // Token files
  /api[-_]?key/i,                    // API key files
];


/**
 * Check if filename matches any sensitive pattern
 */
function isSensitiveFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);

  // Check against sensitive file patterns
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}


/**
 * Normalize path to prevent traversal attacks
 * Resolves ., .., and removes redundant slashes
 */
export function normalizePath(inputPath: string): string {
  // Resolve path (handles .. and .)
  const normalized = path.posix.normalize(inputPath);

  // Ensure path starts with /
  if (!normalized.startsWith('/')) {
    return '/' + normalized;
  }

  return normalized;
}

/**
 * Check if path is within allowed directory
 */
export function isInDirectory(inputPath: string, allowedDir: string): boolean {
  const normalized = normalizePath(inputPath);
  const normalizedDir = normalizePath(allowedDir);

  // Path must start with allowed directory
  return normalized === normalizedDir || normalized.startsWith(normalizedDir + '/');
}

/**
 * Check if path is in any blocked directory
 */
function isInBlockedDirectory(inputPath: string): boolean {
  const normalized = normalizePath(inputPath);

  for (const blockedDir of BLOCKED_DIRS) {
    if (normalized === blockedDir || normalized.startsWith(blockedDir + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Validate path for read operations
 */
export function validateReadPath(inputPath: string): ValidationResult {
  // Check for empty path
  if (!inputPath || inputPath.trim() === '') {
    return {
      valid: false,
      error: 'Path cannot be empty'
    };
  }

  // Normalize path
  const normalized = normalizePath(inputPath);

  // Check for blocked directories
  if (isInBlockedDirectory(normalized)) {
    return {
      valid: false,
      error: `Access to system directory '${normalized}' is not allowed`
    };
  }

  // Check if path is in any allowed read directory
  const inAllowedDir = READ_ALLOWED_DIRS.some(dir => isInDirectory(normalized, dir));

  if (!inAllowedDir) {
    return {
      valid: false,
      error: `Path '${normalized}' is not in allowed directories: ${READ_ALLOWED_DIRS.join(', ')}`
    };
  }

  // SECURITY: Block sensitive files even within allowed directories
  if (isSensitiveFile(normalized)) {
    return {
      valid: false,
      error: `Access to sensitive file '${normalized}' is not allowed for security reasons`
    };
  }

  return {
    valid: true,
    sanitized: normalized
  };
}

/**
 * Validate path for write operations
 */
export function validateWritePath(inputPath: string): ValidationResult {
  // Check for empty path
  if (!inputPath || inputPath.trim() === '') {
    return {
      valid: false,
      error: 'Path cannot be empty'
    };
  }

  // Normalize path
  const normalized = normalizePath(inputPath);

  // Check for blocked directories
  if (isInBlockedDirectory(normalized)) {
    return {
      valid: false,
      error: `Writing to system directory '${normalized}' is not allowed`
    };
  }

  // Check if path is in any allowed write directory
  const inAllowedDir = WRITE_ALLOWED_DIRS.some(dir => isInDirectory(normalized, dir));

  if (!inAllowedDir) {
    return {
      valid: false,
      error: `Write operations are only allowed in /scratch directory. Attempted path: ${normalized}`
    };
  }

  return {
    valid: true,
    sanitized: normalized
  };
}

/**
 * Extract directory from file path
 */
export function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  return path.posix.dirname(normalized);
}

/**
 * Extract filename from file path
 */
export function getFilename(filePath: string): string {
  const normalized = normalizePath(filePath);
  return path.posix.basename(normalized);
}

/**
 * Join path segments safely
 */
export function joinPaths(...segments: string[]): string {
  const joined = path.posix.join(...segments);
  return normalizePath(joined);
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(inputPath: string): boolean {
  return inputPath.startsWith('/');
}

/**
 * Make path absolute (prepend / if relative)
 */
export function makeAbsolute(inputPath: string, basePath: string = '/scratch'): string {
  if (isAbsolutePath(inputPath)) {
    return normalizePath(inputPath);
  }

  return joinPaths(basePath, inputPath);
}

/**
 * Get allowed directories for reads (for documentation/help)
 */
export function getReadAllowedDirectories(): string[] {
  return [...READ_ALLOWED_DIRS];
}

/**
 * Get allowed directories for writes (for documentation/help)
 */
export function getWriteAllowedDirectories(): string[] {
  return [...WRITE_ALLOWED_DIRS];
}

/**
 * Validate and normalize path with detailed error
 */
export function validateAndNormalizePath(
  inputPath: string,
  operation: 'read' | 'write'
): ValidationResult {
  if (operation === 'read') {
    return validateReadPath(inputPath);
  } else {
    return validateWritePath(inputPath);
  }
}
