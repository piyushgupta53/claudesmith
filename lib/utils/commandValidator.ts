/**
 * Command Validator
 *
 * Validates bash commands against whitelist and blocks dangerous operations
 * Provides security layer for safe command execution in Docker containers
 */

import { ValidationResult } from '../types/container';

/**
 * Allowed bash commands (safe for read-only operations and data processing)
 */
const ALLOWED_COMMANDS = new Set([
  // Filesystem inspection (read-only)
  'ls', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'du', 'pwd',

  // Search & filter
  'grep', 'find', 'awk', 'sed',

  // Data processing
  'jq', 'sort', 'uniq', 'cut', 'paste', 'comm', 'diff',

  // Text manipulation
  'echo', 'printf', 'tr', 'expand', 'unexpand', 'fmt',

  // Process inspection (own processes only)
  'ps', 'top', 'kill',

  // Network (restricted - HTTPS only to whitelisted domains)
  'curl',

  // Archive operations (read-only)
  'tar', 'gzip', 'gunzip', 'bzip2', 'bunzip2', 'zip', 'unzip',

  // Utility commands
  'date', 'env', 'which', 'basename', 'dirname', 'realpath', 'readlink',
  'yes', 'seq', 'sleep', 'time', 'timeout',

  // Shell built-ins (safe subset)
  'test', '[', 'true', 'false', 'expr', 'bc', 'cd',

  // Filesystem modification (path-validated)
  // cp: only allowed between allowed directories (sources: /project, /scratch, /claude-cache, /skills)
  // mkdir: only allowed in /scratch
  'cp', 'mkdir',

  // Scripting languages (sandboxed in Docker, safe to run)
  'python3', 'python', 'node', 'nodejs', 'ruby', 'perl', 'php',
  'sh', 'bash',

  // Additional common utilities
  'xargs', 'tee', 'touch',

  // Version control (essential for cloning repos to analyze)
  'git'
]);

/**
 * Blocked commands (dangerous operations)
 * These modify filesystem, system state, or provide unrestricted access
 */
const BLOCKED_COMMANDS = new Set([
  // Filesystem modification (use Write tool instead)
  // Note: cp, mkdir are allowed but validated separately for allowed paths
  'rm', 'mv', 'rmdir', 'touch', 'chmod', 'chown', 'chgrp',
  'ln', 'install', 'dd',

  // Network unrestricted
  'nc', 'netcat', 'telnet', 'ssh', 'scp', 'sftp', 'ftp', 'wget', 'rsync',

  // System modification
  'sudo', 'su', 'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'brew',
  'systemctl', 'service', 'systemd', 'init', 'reboot', 'shutdown', 'halt',
  'mount', 'umount', 'mkfs', 'fdisk', 'parted',

  // Compilation & build
  'gcc', 'g++', 'clang', 'make', 'cmake', 'cargo', 'go', 'rustc', 'javac',

  // Package management
  'npm', 'yarn', 'pnpm', 'pip', 'gem', 'composer',

  // Editors (interactive)
  'vim', 'vi', 'nano', 'emacs', 'ed',

  // Other dangerous commands
  'exec', 'eval', 'source', '.', 'cron', 'crontab', 'at', 'batch'
]);

/**
 * Shell operators and special characters that need validation
 */
const SHELL_OPERATORS = ['&&', '||', ';', '|', '>', '>>', '<', '<<', '<<-', '&', '$(', '`'];

/**
 * Allowed directories for read operations (sources for cp)
 */
const READ_ALLOWED_DIRS = ['/scratch', '/skills', '/claude-cache'];

/**
 * Allowed directories for write operations (destinations for cp, mkdir)
 */
const WRITE_ALLOWED_DIRS = ['/scratch'];

/**
 * Check if a path is within allowed directories
 */
function isPathAllowed(pathArg: string, allowedDirs: string[]): boolean {
  // Normalize path - remove quotes
  const cleanPath = pathArg.replace(/^['"]|['"]$/g, '');

  // Check if path starts with any allowed directory
  return allowedDirs.some(dir =>
    cleanPath === dir || cleanPath.startsWith(dir + '/')
  );
}

/**
 * Validate cp command - ensure source is readable and destination is in /scratch
 */
function validateCpCommand(command: string): string | null {
  const tokens = parseCommandTokens(command);

  // Find the cp command and its arguments
  const cpIndex = tokens.findIndex(t => extractCommandName(t) === 'cp');
  if (cpIndex === -1) return null;

  // Get arguments after cp (skip flags like -r, -R, -a)
  const args: string[] = [];
  for (let i = cpIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    // Skip if it's an operator
    if (isOperatorOrRedirect(token)) break;
    // Skip flags
    if (token.startsWith('-')) continue;
    args.push(token);
  }

  if (args.length < 2) {
    return 'cp requires at least source and destination arguments';
  }

  // Last argument is destination
  const destination = args[args.length - 1];
  // All other arguments are sources
  const sources = args.slice(0, -1);

  // Validate all sources are in read-allowed directories
  for (const source of sources) {
    if (!isPathAllowed(source, READ_ALLOWED_DIRS)) {
      return `cp source '${source}' is not in allowed directories: ${READ_ALLOWED_DIRS.join(', ')}`;
    }
  }

  // Validate destination is in write-allowed directories
  if (!isPathAllowed(destination, WRITE_ALLOWED_DIRS)) {
    return `cp destination '${destination}' must be in /scratch directory`;
  }

  return null; // Validation passed
}

/**
 * Validate mkdir command - ensure path is in /scratch
 */
function validateMkdirCommand(command: string): string | null {
  const tokens = parseCommandTokens(command);

  // Find the mkdir command and its arguments
  const mkdirIndex = tokens.findIndex(t => extractCommandName(t) === 'mkdir');
  if (mkdirIndex === -1) return null;

  // Get arguments after mkdir (skip flags like -p)
  const paths: string[] = [];
  for (let i = mkdirIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    // Skip if it's an operator
    if (isOperatorOrRedirect(token)) break;
    // Skip flags
    if (token.startsWith('-')) continue;
    paths.push(token);
  }

  if (paths.length === 0) {
    return 'mkdir requires at least one path argument';
  }

  // Validate all paths are in write-allowed directories
  for (const path of paths) {
    if (!isPathAllowed(path, WRITE_ALLOWED_DIRS)) {
      return `mkdir path '${path}' must be in /scratch directory`;
    }
  }

  return null; // Validation passed
}

/**
 * Validate path-restricted commands (cp, mkdir)
 */
function validatePathRestrictedCommands(command: string): string | null {
  const tokens = parseCommandTokens(command);

  for (const token of tokens) {
    const cmdName = extractCommandName(token);

    if (cmdName === 'cp') {
      const error = validateCpCommand(command);
      if (error) return error;
    }

    if (cmdName === 'mkdir') {
      const error = validateMkdirCommand(command);
      if (error) return error;
    }
  }

  return null;
}

/**
 * Parse command string into tokens
 * Handles quotes and escaping
 */
export function parseCommandTokens(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Extract command name from token (handles pipes and redirects)
 */
function extractCommandName(token: string): string {
  // Remove quotes
  const cleaned = token.replace(/^['"]|['"]$/g, '');

  // Remove leading path (e.g., /bin/cat -> cat)
  const withoutPath = cleaned.split('/').pop() || cleaned;

  // Get first word (command name) - split on spaces if present
  const parts = withoutPath.split(/\s+/);
  return parts[0] || '';
}

/**
 * Check if command contains blocked commands
 * Only checks tokens that are actual commands (after operators), not arguments
 */
export function containsBlockedCommand(command: string): boolean {
  // Handle heredoc commands specially - only check the command line, not the heredoc content
  const heredocInfo = parseHeredocCommand(command);
  const commandToCheck = heredocInfo.hasHeredoc ? heredocInfo.commandLine : command;

  const tokens = parseCommandTokens(commandToCheck);

  // Track if we're expecting a command (vs an argument)
  let expectingCommand = true;
  // Track if we're in a heredoc operator context (next token is delimiter, not command)
  let expectingHeredocDelimiter = false;

  for (const token of tokens) {
    // After << or <<-, the next token is the heredoc delimiter, not a command
    if (expectingHeredocDelimiter) {
      expectingHeredocDelimiter = false;
      expectingCommand = false;
      continue;
    }

    // Check for heredoc operator
    if (token === '<<' || token === '<<-') {
      expectingHeredocDelimiter = true;
      continue;
    }

    // Skip operators and redirects, but mark next token as command
    if (isOperatorOrRedirect(token)) {
      expectingCommand = true;
      continue;
    }

    // Only check if we're expecting a command
    if (expectingCommand) {
      const cmdName = extractCommandName(token);
      if (cmdName && BLOCKED_COMMANDS.has(cmdName)) {
        return true;
      }
      expectingCommand = false; // Next tokens are arguments
    }
    // Arguments are not checked against blocked commands
  }

  return false;
}

/**
 * Check if token is a shell operator or redirect
 */
function isOperatorOrRedirect(token: string): boolean {
  return (
    SHELL_OPERATORS.includes(token) ||
    token === '>' ||
    token === '>>' ||
    token === '<' ||
    token === '<<' ||
    token === '<<-' ||
    token === '&'
  );
}

/**
 * Extract the first command line from a multi-line command (before heredoc content)
 * This is used to validate the command part separately from heredoc content
 */
function extractCommandLineBeforeHeredoc(command: string): string {
  // Check if command contains heredoc
  const heredocMatch = command.match(/<<-?\s*['"]?(\w+)['"]?/);
  if (!heredocMatch) {
    return command;
  }

  // Return everything up to and including the heredoc operator and delimiter
  const firstLineEnd = command.indexOf('\n');
  if (firstLineEnd === -1) {
    return command;
  }
  return command.substring(0, firstLineEnd);
}

/**
 * Check if a command contains a heredoc and validate it properly
 * Returns: { hasHeredoc: boolean, firstCommand: string, isValid: boolean }
 */
function parseHeredocCommand(command: string): {
  hasHeredoc: boolean;
  commandLine: string;
  heredocDelimiter: string | null;
  isProperlyTerminated: boolean;
} {
  // Match heredoc patterns: << EOF, <<EOF, <<'EOF', <<"EOF", <<-EOF, etc.
  const heredocRegex = /<<-?\s*['"]?(\w+)['"]?/;
  const match = command.match(heredocRegex);

  if (!match) {
    return {
      hasHeredoc: false,
      commandLine: command,
      heredocDelimiter: null,
      isProperlyTerminated: true
    };
  }

  const delimiter = match[1];
  const commandLine = extractCommandLineBeforeHeredoc(command);

  // Check if the heredoc is properly terminated (delimiter appears on its own line at the end)
  const lines = command.split('\n');
  const lastNonEmptyLine = lines.filter(l => l.trim()).pop()?.trim();
  const isProperlyTerminated = lastNonEmptyLine === delimiter;

  return {
    hasHeredoc: true,
    commandLine,
    heredocDelimiter: delimiter,
    isProperlyTerminated
  };
}

/**
 * Check if all commands in the string are allowed
 */
function areAllCommandsAllowed(command: string): boolean {
  // Handle heredoc commands specially - only validate the command line, not the heredoc content
  const heredocInfo = parseHeredocCommand(command);
  const commandToValidate = heredocInfo.hasHeredoc ? heredocInfo.commandLine : command;

  const tokens = parseCommandTokens(commandToValidate);

  // Track if we're expecting a command (vs an argument)
  let expectingCommand = true;
  // Track if we're in a heredoc operator context (next token is delimiter, not command)
  let expectingHeredocDelimiter = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // After << or <<-, the next token is the heredoc delimiter, not a command
    if (expectingHeredocDelimiter) {
      expectingHeredocDelimiter = false;
      expectingCommand = false; // After delimiter, we're back to expecting arguments
      continue;
    }

    // Check for heredoc operator
    if (token === '<<' || token === '<<-') {
      expectingHeredocDelimiter = true;
      continue;
    }

    // Skip other operators and redirects
    if (isOperatorOrRedirect(token)) {
      expectingCommand = true; // Next token should be a command
      continue;
    }

    // Only validate if we're expecting a command
    if (expectingCommand) {
      const cmdName = extractCommandName(token);

      // Skip empty tokens
      if (!cmdName) {
        continue;
      }

      // Check if command is allowed
      if (!ALLOWED_COMMANDS.has(cmdName)) {
        // Check if explicitly blocked
        if (BLOCKED_COMMANDS.has(cmdName)) {
          return false;
        }

        // Unknown command - block by default for security
        // Unless it starts with / (might be a path argument we're treating as command)
        if (!token.startsWith('/')) {
          return false;
        }
      }

      expectingCommand = false; // Next tokens are arguments
    }
    // Else: it's an argument, skip validation
  }

  return true;
}

/**
 * Detect dangerous patterns in command
 */
function detectDangerousPatterns(command: string): string | null {
  // Command substitution with $()
  if (command.includes('$(')) {
    return 'Command substitution with $() is not allowed';
  }

  // Command substitution with backticks
  if (command.includes('`')) {
    return 'Command substitution with backticks is not allowed';
  }

  // Check for output redirects (but not heredocs or input redirects)
  // Heredocs (<< or <<-) are safe - they provide stdin, not file output
  // Input redirects (<) are safe - they read files, not write

  // Find all > characters that are actual output redirects
  // Skip: >>, <<, >=, <=, and > inside quotes
  const outputRedirectMatch = command.match(/(?<![<>])>(?!>|=)/g);

  if (outputRedirectMatch) {
    // Check each output redirect
    // Allow: > /scratch/..., > /dev/null, 2>&1, >&2, etc.
    const allowedRedirectPattern = />\s*(\/scratch\/|\/dev\/null|&[12])/;
    if (!allowedRedirectPattern.test(command)) {
      // Check if ALL redirects go to allowed places
      const redirectTargets = command.match(/(?<![<>])>\s*([^\s|&;]+)/g);
      if (redirectTargets) {
        for (const target of redirectTargets) {
          const path = target.replace(/^>\s*/, '');
          if (!path.startsWith('/scratch/') && !path.startsWith('/dev/null') && !path.startsWith('&')) {
            return 'File redirects are only allowed to /scratch directory or /dev/null';
          }
        }
      }
    }
  }

  // Append redirects
  if (command.includes('>>')) {
    // Allow append to /scratch only
    const appendTargets = command.match(/>>\s*([^\s|&;]+)/g);
    if (appendTargets) {
      for (const target of appendTargets) {
        const path = target.replace(/^>>\s*/, '');
        if (!path.startsWith('/scratch/')) {
          return 'File appends are only allowed to /scratch directory';
        }
      }
    }
  }

  return null;
}

/**
 * Sanitize command string
 * Removes potentially dangerous characters while preserving functionality
 */
export function sanitizeCommand(command: string): string {
  // Trim whitespace
  let sanitized = command.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove carriage returns
  sanitized = sanitized.replace(/\r/g, '');

  // Normalize multiple spaces/tabs on same line, but preserve newlines for heredocs
  // [^\S\n]+ matches whitespace except newlines
  sanitized = sanitized.replace(/[^\S\n]+/g, ' ');

  // Normalize multiple consecutive newlines to single newline
  sanitized = sanitized.replace(/\n+/g, '\n');

  return sanitized;
}

/**
 * Validate bash command
 * Returns validation result with error message if invalid
 */
export function validateBashCommand(command: string): ValidationResult {
  // Check for empty command
  if (!command || command.trim() === '') {
    return {
      valid: false,
      error: 'Command cannot be empty'
    };
  }

  // Sanitize command
  const sanitized = sanitizeCommand(command);

  // Check for dangerous patterns
  const dangerousPattern = detectDangerousPatterns(sanitized);
  if (dangerousPattern) {
    return {
      valid: false,
      error: dangerousPattern
    };
  }

  // Check for blocked commands
  if (containsBlockedCommand(sanitized)) {
    const tokens = parseCommandTokens(sanitized);
    const blockedCmd = tokens.find(t => BLOCKED_COMMANDS.has(extractCommandName(t)));
    return {
      valid: false,
      error: `Command '${extractCommandName(blockedCmd!)}' is not allowed. Use Write tool for file modifications.`
    };
  }

  // Check if all commands are allowed
  if (!areAllCommandsAllowed(sanitized)) {
    return {
      valid: false,
      error: 'Command contains unknown or disallowed operations'
    };
  }

  // Validate path-restricted commands (cp, mkdir)
  const pathError = validatePathRestrictedCommands(sanitized);
  if (pathError) {
    return {
      valid: false,
      error: pathError
    };
  }

  return {
    valid: true,
    sanitized
  };
}

/**
 * Get list of allowed commands (for documentation/help)
 */
export function getAllowedCommands(): string[] {
  return Array.from(ALLOWED_COMMANDS).sort();
}

/**
 * Get list of blocked commands (for documentation/help)
 */
export function getBlockedCommands(): string[] {
  return Array.from(BLOCKED_COMMANDS).sort();
}
