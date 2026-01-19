/**
 * Safe Code Executor
 *
 * Provides sandboxed execution of user-defined code for hooks and custom tools.
 * Uses restricted evaluation context to prevent access to sensitive APIs.
 */

import vm from 'vm';

/**
 * Blocked global APIs that should never be accessible in user code
 */
const BLOCKED_GLOBALS = [
  // Process control
  'process',
  'child_process',
  'spawn',
  'exec',
  'execSync',
  'fork',

  // File system
  'fs',
  'require',
  'import',
  '__dirname',
  '__filename',
  'module',
  'exports',

  // Network
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'http',
  'https',
  'net',
  'dgram',
  'tls',

  // Dangerous globals
  'eval',
  'Function',
  'Proxy',
  'Reflect',
  'globalThis',
  'global',
  'root',
  'GLOBAL',
  'window',
  'self',
];

/**
 * Patterns that indicate potentially malicious code
 */
const DANGEROUS_PATTERNS = [
  // Process/system access
  /process\s*\./,
  /child_process/,
  /require\s*\(/,
  /import\s*\(/,
  /import\s+.*from/,

  // File system
  /fs\s*\./,
  /readFile/i,
  /writeFile/i,
  /unlink/i,
  /rmdir/i,

  // Network
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /\.listen\s*\(/,
  /\.connect\s*\(/,

  // Code generation/eval
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /Function\s*\(/,
  /setTimeout\s*\([^,]*,/,  // setTimeout with string arg
  /setInterval\s*\([^,]*,/, // setInterval with string arg

  // Prototype pollution
  /__proto__/,
  /constructor\s*\[/,
  /prototype\s*\[/,

  // Buffer/binary operations (potential for exploits)
  /Buffer\.allocUnsafe/,
];

/**
 * Result of code validation
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate user code before execution
 */
export function validateCode(code: string): ValidationResult {
  const warnings: string[] = [];

  // Check for empty code
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Code cannot be empty' };
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains blocked pattern: ${pattern.source}`
      };
    }
  }

  // Check for blocked global references
  // Strip string literals and regex patterns to avoid false positives
  // e.g., 'node-fetch' or /spawn/ should not trigger the validator
  const codeWithoutStrings = code
    .replace(/'[^']*'/g, '""')  // Single-quoted strings
    .replace(/"[^"]*"/g, '""')  // Double-quoted strings
    .replace(/`[^`]*`/g, '""')  // Template literals (simple)
    .replace(/\/[^/]+\/[gimsuy]*/g, '//');  // Regex literals

  for (const global of BLOCKED_GLOBALS) {
    // Match word boundary to avoid false positives
    const regex = new RegExp(`\\b${global}\\b`);
    if (regex.test(codeWithoutStrings)) {
      return {
        valid: false,
        error: `Code references blocked global: ${global}`
      };
    }
  }

  // Warn about potentially risky patterns
  if (/\bthis\b/.test(code)) {
    warnings.push("Code uses 'this' which may have unexpected behavior in sandbox");
  }

  if (/\barguments\b/.test(code)) {
    warnings.push("Code uses 'arguments' which may have unexpected behavior in sandbox");
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Create a safe execution context with only allowed globals
 */
function createSafeContext(additionalContext: Record<string, unknown> = {}): vm.Context {
  // Create minimal safe context
  const safeGlobals = {
    // Safe built-ins
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Symbol,

    // Safe methods
    JSON,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,

    // Console for debugging (safe)
    console: {
      log: (...args: unknown[]) => console.log('[Sandbox]', ...args),
      warn: (...args: unknown[]) => console.warn('[Sandbox]', ...args),
      error: (...args: unknown[]) => console.error('[Sandbox]', ...args),
      info: (...args: unknown[]) => console.info('[Sandbox]', ...args),
    },

    // Undefined dangerous globals (prevents "X is not defined" leaking info)
    ...Object.fromEntries(BLOCKED_GLOBALS.map(g => [g, undefined])),

    // User-provided context
    ...additionalContext,
  };

  return vm.createContext(safeGlobals);
}

/**
 * Options for safe code execution
 */
export interface ExecuteOptions {
  timeout?: number;           // Execution timeout in ms (default: 5000)
  context?: Record<string, unknown>;  // Additional context variables
}

/**
 * Execute code in a sandboxed environment
 *
 * @param code - The code to execute
 * @param args - Arguments to pass to the code (accessible as named variables)
 * @param options - Execution options
 * @returns The result of the code execution
 */
export async function executeCodeSafely<T = unknown>(
  code: string,
  args: Record<string, unknown> = {},
  options: ExecuteOptions = {}
): Promise<T> {
  // Validate code first
  const validation = validateCode(code);
  if (!validation.valid) {
    throw new Error(`Code validation failed: ${validation.error}`);
  }

  if (validation.warnings) {
    validation.warnings.forEach(w => console.warn(`[SafeExecutor] Warning: ${w}`));
  }

  const timeout = options.timeout ?? 5000;

  // Create context with args
  const context = createSafeContext({
    ...options.context,
    ...args,
  });

  try {
    // Wrap code in async IIFE for consistent async handling
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `;

    // Create and run script with timeout
    const script = new vm.Script(wrappedCode, {
      filename: 'user-code.js',
    });

    const result = script.runInContext(context, {
      timeout: timeout,
      breakOnSigint: true,
    });

    // If result is a promise, await it with timeout
    if (result && typeof result.then === 'function') {
      return await Promise.race([
        result,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Async execution timeout')), timeout)
        )
      ]) as T;
    }

    return result as T;
  } catch (error) {
    if (error instanceof Error) {
      // Sanitize error message to prevent information leakage
      if (error.message.includes('Script execution timed out')) {
        throw new Error('Code execution timeout exceeded');
      }
      throw new Error(`Code execution failed: ${error.message}`);
    }
    throw new Error('Code execution failed with unknown error');
  }
}

/**
 * Create a safe hook handler function
 *
 * @param code - The hook code as a string
 * @returns A function that can be used as a hook handler
 */
export function createSafeHookHandler(
  code: string
): (input: unknown, toolUseID: string | undefined, options: { signal: AbortSignal }) => Promise<unknown> {
  // Validate code at creation time
  const validation = validateCode(code);
  if (!validation.valid) {
    throw new Error(`Hook code validation failed: ${validation.error}`);
  }

  return async (input: unknown, toolUseID: string | undefined, options: { signal: AbortSignal }) => {
    // Check if aborted
    if (options.signal.aborted) {
      throw new Error('Hook execution aborted');
    }

    return executeCodeSafely(code, {
      input,
      toolUseID,
      // Don't pass the full options object (contains signal which could be abused)
    }, {
      timeout: 5000,
    });
  };
}

/**
 * Create a safe custom tool handler function
 *
 * @param code - The tool handler code as a string
 * @param toolName - Name of the tool (for error messages)
 * @returns A function that can be used as a tool handler
 */
export function createSafeToolHandler(
  code: string,
  toolName: string
): (args: Record<string, unknown>, context: unknown) => Promise<unknown> {
  // Validate code at creation time
  const validation = validateCode(code);
  if (!validation.valid) {
    throw new Error(`Tool '${toolName}' handler code validation failed: ${validation.error}`);
  }

  return async (args: Record<string, unknown>, context: unknown) => {
    return executeCodeSafely(code, {
      args,
      context,
    }, {
      timeout: 10000, // Tools get more time
    });
  };
}

/**
 * Create a safe dynamic context loader function
 *
 * @param code - The loader code as a string
 * @returns A function that loads dynamic context
 */
export function createSafeContextLoader(
  code: string
): () => Promise<Record<string, unknown>> {
  // Validate code at creation time
  const validation = validateCode(code);
  if (!validation.valid) {
    throw new Error(`Context loader code validation failed: ${validation.error}`);
  }

  return async () => {
    const result = await executeCodeSafely<unknown>(code, {}, {
      timeout: 5000,
    });

    // Ensure result is an object
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result as Record<string, unknown>;
    }

    return {};
  };
}

/**
 * Create a safe canUseTool callback function
 *
 * @param code - The callback code as a string
 * @returns A function that can be used as canUseTool callback
 */
export function createSafeCanUseToolCallback(
  code: string
): (toolName: string, input: Record<string, unknown>, options: unknown) => Promise<unknown> {
  // Validate code at creation time
  const validation = validateCode(code);
  if (!validation.valid) {
    throw new Error(`canUseTool callback code validation failed: ${validation.error}`);
  }

  return async (toolName: string, input: Record<string, unknown>, _options: unknown) => {
    return executeCodeSafely(code, {
      toolName,
      input,
      // Don't pass options as it may contain sensitive data
    }, {
      timeout: 5000,
    });
  };
}
