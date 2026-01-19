/**
 * Docker MCP Server
 *
 * Provides Read, Write, Bash tools that execute inside the Docker container
 * These tools are exposed via MCP protocol and named mcp__docker__<toolname>
 * to avoid conflicts with SDK's built-in tools
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import { dockerService } from '../services/dockerService';
import { validateBashCommand } from '../utils/commandValidator';
import { validateWritePath, validateReadPath } from '../utils/pathValidator';
import type { ResourceLimits } from '../types/agent';
import { DEFAULT_RESOURCE_LIMITS } from '../types/agent';

/**
 * Escape a string for safe use in shell commands
 * Uses single quotes and escapes any embedded single quotes
 */
function shellEscape(str: string): string {
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Truncate tool results that exceed the maximum size
 * This prevents memory issues and improves UX for large outputs
 *
 * @param result - The result string to potentially truncate
 * @param maxSize - Maximum allowed size in characters
 * @param includeHints - Whether to include helpful hints about how to handle truncation
 */
function truncateResult(
  result: string,
  maxSize: number,
  includeHints: boolean
): string {
  if (result.length <= maxSize) {
    return result;
  }

  const truncated = result.slice(0, maxSize);
  const omittedChars = result.length - maxSize;

  if (includeHints) {
    return truncated +
      `\n\n[Truncated: Result exceeded ${maxSize.toLocaleString()} characters (${omittedChars.toLocaleString()} chars omitted). ` +
      `To retrieve complete data, try:\n` +
      `- Use pagination (smaller page_size)\n` +
      `- Filter results more specifically\n` +
      `- Request specific fields instead of full content]`;
  }

  return truncated +
    `\n\n[Truncated: ${omittedChars.toLocaleString()} characters omitted]`;
}

/**
 * Format error messages with helpful recovery hints
 * Helps agents understand how to retry or work around errors
 */
function formatErrorWithHints(
  error: Error | string,
  toolName: string,
  includeHints: boolean
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (!includeHints) {
    return `Error in ${toolName}: ${errorMessage}`;
  }

  // Check for timeout errors
  if (errorMessage.toLowerCase().includes('timeout') ||
      errorMessage.toLowerCase().includes('timed out')) {
    return `Error in ${toolName}: ${errorMessage}\n\n` +
      `[Hint: Command timed out. To resolve:\n` +
      `- Break the operation into smaller chunks\n` +
      `- Use more specific filters to reduce processing\n` +
      `- Consider if the operation can be split into multiple steps]`;
  }

  // Check for size/memory errors
  if (errorMessage.toLowerCase().includes('size') ||
      errorMessage.toLowerCase().includes('memory') ||
      errorMessage.toLowerCase().includes('too large')) {
    return `Error in ${toolName}: ${errorMessage}\n\n` +
      `[Hint: Operation exceeded size limits. To resolve:\n` +
      `- Use pagination (smaller page_size)\n` +
      `- Filter results more specifically\n` +
      `- Process data in smaller batches]`;
  }

  // Check for permission errors
  if (errorMessage.toLowerCase().includes('permission') ||
      errorMessage.toLowerCase().includes('access denied') ||
      errorMessage.toLowerCase().includes('not allowed')) {
    return `Error in ${toolName}: ${errorMessage}\n\n` +
      `[Hint: Permission denied. Files can only be written to /scratch directory. ` +
      `Read access is available for /scratch, /skills, and /claude-cache.]`;
  }

  // Default: return error with generic hint
  return `Error in ${toolName}: ${errorMessage}`;
}

/**
 * Check if a path looks like a host filesystem path (outside container)
 * Returns helpful error message if it's a host path that can't be mapped
 */
function detectHostPath(path: string): { isHostPath: boolean; error?: string } {
  // Detect common host path patterns that won't work inside the container
  const hostPathPatterns = [
    // macOS
    /^\/Users\/[^/]+(?!\/\.claude\/projects)/,
    // Linux
    /^\/home\/[^/]+(?!\/\.claude\/projects)/,
    // Windows (shouldn't appear but just in case)
    /^[A-Za-z]:\\/,
    // Generic absolute paths that look like host filesystem
    /^\/(?:var|tmp|opt|etc|usr|bin|sbin|lib|root)(?:\/|$)/,
  ];

  for (const pattern of hostPathPatterns) {
    if (pattern.test(path)) {
      return {
        isHostPath: true,
        error: `Path "${path}" appears to be a host filesystem path which is not accessible inside the container.

**How to fix this:**
1. Files must be in the /scratch directory
2. Use FileManager to clone repos: Task(FileManager, "Clone <url> to /scratch/project")
3. Then reference files using /scratch paths: /scratch/project/file.txt

**Available directories:**
- /scratch (read-write): Your workspace - clone repos and save files here
- /skills (read-only): Skill definitions
- /claude-cache (read-only): Cached tool results

Example: Instead of "/Users/name/project/file.go", use "/scratch/project/file.go" after cloning.`
      };
    }
  }

  return { isHostPath: false };
}

/**
 * Map host paths to container paths
 * Handles SDK tool result files saved to ~/.claude/projects/
 *
 * Host path: /Users/<user>/.claude/projects/... → Container path: /claude-cache/projects/...
 *
 * SECURITY: Only ~/.claude/projects/ is mounted (contains tool result caches)
 * Other ~/.claude/ paths (settings.json, history, etc.) are NOT accessible
 */
function mapHostPathToContainer(hostPath: string): string {
  // Match paths like /Users/<user>/.claude/projects/... or /home/<user>/.claude/projects/...
  const claudeProjectsMatch = hostPath.match(/^\/(?:Users|home)\/[^/]+\/\.claude\/projects\/(.+)$/);
  if (claudeProjectsMatch) {
    const relativePath = claudeProjectsMatch[1];
    console.log(`[DockerMCP] Mapping host path to container: ${hostPath} → /claude-cache/projects/${relativePath}`);
    return `/claude-cache/projects/${relativePath}`;
  }

  // Return original path if no mapping needed
  return hostPath;
}

/**
 * Create an MCP server with Docker-sandboxed tools
 * @param containerId - The Docker container ID to execute commands in
 * @param sessionId - Session ID for logging
 * @param limits - Resource limits for tool execution (optional, uses defaults if not provided)
 */
export function createDockerMcpServer(
  containerId: string,
  sessionId: string,
  limits?: Required<ResourceLimits>
) {
  // Use provided limits or fall back to defaults
  const resourceLimits = limits || DEFAULT_RESOURCE_LIMITS;
  const { maxResultSize, maxToolTimeoutMs, includeErrorHints } = resourceLimits;

  console.log(`[DockerMCP] Creating MCP server for container ${containerId.substring(0, 12)}`);
  console.log(`[DockerMCP] Resource limits: maxResultSize=${maxResultSize}, timeout=${maxToolTimeoutMs}ms, hints=${includeErrorHints}`);

  return createSdkMcpServer({
    name: 'docker',
    version: '1.0.0',
    tools: [
      // Read tool - reads files from container
      tool(
        'Read',
        `Read a file from the container filesystem.

Available directories:
- /scratch (read-write): Session workspace for temporary files
- /skills (read-only): Skill definitions
- /claude-cache/projects (read-only): SDK tool result cache files

Note: Host paths like /Users/<user>/.claude/projects/... are automatically mapped to /claude-cache/projects/...

To access project files, use GitHub MCP Server, file uploads to /scratch, or custom MCP servers.

Example: Read({ file_path: "/scratch/data.json" })`,
        {
          file_path: z.string().describe('Absolute path to the file to read'),
        },
        async (args) => {
          try {
            // Check for host filesystem paths first (with helpful error)
            const hostPathCheck = detectHostPath(args.file_path);
            if (hostPathCheck.isHostPath) {
              console.error(`[DockerMCP] Read blocked: host path detected: ${args.file_path}`);
              return {
                content: [{ type: 'text' as const, text: hostPathCheck.error! }],
                isError: true
              };
            }

            // Map host paths to container paths (e.g., ~/.claude/ → /claude-cache/)
            const mappedPath = mapHostPathToContainer(args.file_path);

            // Validate path to prevent traversal attacks
            const validation = validateReadPath(mappedPath);
            if (!validation.valid) {
              console.error(`[DockerMCP] Read path validation failed: ${validation.error}`);
              return {
                content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
                isError: true
              };
            }

            const safePath = validation.sanitized!;
            console.log(`[DockerMCP] Read: ${safePath}`);
            const content = await dockerService.readFile(containerId, safePath);
            const truncatedContent = truncateResult(content, maxResultSize, includeErrorHints);
            return {
              content: [{ type: 'text' as const, text: truncatedContent }]
            };
          } catch (error: any) {
            console.error(`[DockerMCP] Read error: ${error.message}`);
            return {
              content: [{
                type: 'text' as const,
                text: formatErrorWithHints(error, 'Read', includeErrorHints)
              }],
              isError: true
            };
          }
        }
      ),

      // Write tool - writes files to container /scratch
      tool(
        'Write',
        `Write content to a file in the container. Can only write to /scratch directory.

Example: Write({ file_path: "/scratch/output.txt", content: "Hello World" })

Parent directories are created automatically.`,
        {
          file_path: z.string().describe('Absolute path in /scratch directory'),
          content: z.string().describe('Content to write to the file'),
        },
        async (args) => {
          try {
            // Validate path using proper path validator (prevents traversal attacks)
            const validation = validateWritePath(args.file_path);
            if (!validation.valid) {
              console.error(`[DockerMCP] Write path validation failed: ${validation.error}`);
              return {
                content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
                isError: true
              };
            }

            const safePath = validation.sanitized!;
            console.log(`[DockerMCP] Write: ${safePath} (${args.content.length} chars)`);
            await dockerService.writeFile(containerId, safePath, args.content);
            const bytesWritten = Buffer.byteLength(args.content, 'utf8');

            return {
              content: [{
                type: 'text' as const,
                text: `File written successfully: ${safePath} (${bytesWritten} bytes)`
              }]
            };
          } catch (error: any) {
            console.error(`[DockerMCP] Write error: ${error.message}`);
            return {
              content: [{
                type: 'text' as const,
                text: formatErrorWithHints(error, 'Write', includeErrorHints)
              }],
              isError: true
            };
          }
        }
      ),

      // Bash tool - executes commands in container
      tool(
        'Bash',
        `Execute a bash command inside the Docker container.

Commands run in /scratch directory by default. The container has:
- Standard Linux tools (ls, cat, grep, sed, awk, etc.)
- jq, curl, git (installed on first use)
- python3, nodejs (installed on first use)

SECURITY: Commands are validated against an allowlist. Dangerous operations
(rm, sudo, wget, etc.) are blocked. Use Write tool for file modifications.

Examples:
- Bash({ command: "ls -la /scratch" })
- Bash({ command: "cat /scratch/data.json | jq '.dependencies'" })
- Bash({ command: "grep -r 'TODO' /scratch" })`,
        {
          command: z.string().describe('Bash command to execute'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
        },
        async (args) => {
          try {
            // Validate command against security allowlist
            const validation = validateBashCommand(args.command);
            if (!validation.valid) {
              console.error(`[DockerMCP] Bash command blocked: ${validation.error}`);
              return {
                content: [{ type: 'text' as const, text: `Command blocked: ${validation.error}` }],
                isError: true
              };
            }

            const safeCommand = validation.sanitized!;
            console.log(`[DockerMCP] Bash: ${safeCommand.substring(0, 50)}...`);
            // Use configured timeout, with user-specified timeout as override (capped at configured max)
            const timeout = Math.min(args.timeout || maxToolTimeoutMs, maxToolTimeoutMs);
            const result = await dockerService.executeCommand(
              containerId,
              safeCommand,
              '/scratch',
              timeout
            );

            let output = '';
            if (result.stdout) {
              output += result.stdout;
            }
            if (result.stderr) {
              output += (output ? '\n' : '') + `STDERR: ${result.stderr}`;
            }
            if (!output) {
              output = `Command completed with exit code ${result.exitCode}`;
            }

            // Truncate large outputs using configured limits
            const truncatedOutput = truncateResult(output, maxResultSize, includeErrorHints);

            console.log(`[DockerMCP] Bash completed: exit=${result.exitCode}, time=${result.executionTime}ms`);

            return {
              content: [{
                type: 'text' as const,
                text: truncatedOutput
              }],
              isError: result.exitCode !== 0
            };
          } catch (error: any) {
            console.error(`[DockerMCP] Bash error: ${error.message}`);
            return {
              content: [{
                type: 'text' as const,
                text: formatErrorWithHints(error, 'Bash', includeErrorHints)
              }],
              isError: true
            };
          }
        }
      ),

      // Glob tool - find files by pattern
      tool(
        'Glob',
        `Find files matching a glob pattern in the container.

Example: Glob({ pattern: "*.json", path: "/scratch" })`,
        {
          pattern: z.string().describe('Glob pattern to match files (e.g., "*.ts", "*.json")'),
          path: z.string().optional().describe('Base directory to search in (default: /scratch)'),
        },
        async (args) => {
          try {
            // Validate base path
            const basePath = args.path || '/scratch';

            // Check for host filesystem paths first (with helpful error)
            const hostPathCheck = detectHostPath(basePath);
            if (hostPathCheck.isHostPath) {
              console.error(`[DockerMCP] Glob blocked: host path detected: ${basePath}`);
              return {
                content: [{ type: 'text' as const, text: hostPathCheck.error! }],
                isError: true
              };
            }

            const pathValidation = validateReadPath(basePath);
            if (!pathValidation.valid) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${pathValidation.error}` }],
                isError: true
              };
            }

            const safePath = pathValidation.sanitized!;

            // Extract just the filename pattern (last segment) and escape for shell
            const patternPart = args.pattern.split('/').pop() || '*';
            const safePattern = shellEscape(patternPart);

            console.log(`[DockerMCP] Glob: ${safePattern} in ${safePath}`);

            // Use find command with properly escaped arguments
            const result = await dockerService.executeCommand(
              containerId,
              `find ${shellEscape(safePath)} -name ${safePattern} 2>/dev/null || true`,
              '/scratch',
              Math.min(maxToolTimeoutMs, 30000) // Glob uses shorter timeout
            );

            const files = result.stdout.split('\n').filter(f => f.trim());

            return {
              content: [{
                type: 'text' as const,
                text: files.length > 0 ? files.join('\n') : 'No files found'
              }]
            };
          } catch (error: any) {
            console.error(`[DockerMCP] Glob error: ${error.message}`);
            return {
              content: [{
                type: 'text' as const,
                text: formatErrorWithHints(error, 'Glob', includeErrorHints)
              }],
              isError: true
            };
          }
        }
      ),

      // Grep tool - search file contents
      tool(
        'Grep',
        `Search for a pattern in files.

Example: Grep({ pattern: "TODO", path: "/scratch" })`,
        {
          pattern: z.string().describe('Regular expression pattern to search for'),
          path: z.string().describe('File or directory to search in'),
          include: z.string().optional().describe('File pattern to include (e.g., "*.ts")'),
        },
        async (args) => {
          try {
            // Check for host filesystem paths first (with helpful error)
            const hostPathCheck = detectHostPath(args.path);
            if (hostPathCheck.isHostPath) {
              console.error(`[DockerMCP] Grep blocked: host path detected: ${args.path}`);
              return {
                content: [{ type: 'text' as const, text: hostPathCheck.error! }],
                isError: true
              };
            }

            // Validate search path
            const pathValidation = validateReadPath(args.path);
            if (!pathValidation.valid) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${pathValidation.error}` }],
                isError: true
              };
            }

            const safePath = pathValidation.sanitized!;
            // Escape all user inputs to prevent command injection
            const safePattern = shellEscape(args.pattern);

            console.log(`[DockerMCP] Grep: ${safePattern} in ${safePath}`);

            // Build command with properly escaped arguments
            let cmd = `grep -r ${safePattern} ${shellEscape(safePath)}`;
            if (args.include) {
              const safeInclude = shellEscape(args.include);
              cmd = `grep -r --include=${safeInclude} ${safePattern} ${shellEscape(safePath)}`;
            }
            cmd += ' 2>/dev/null || true';

            const result = await dockerService.executeCommand(
              containerId,
              cmd,
              '/scratch',
              maxToolTimeoutMs
            );

            // Truncate large grep outputs using configured limits
            const output = result.stdout || 'No matches found';
            const truncatedOutput = truncateResult(output, maxResultSize, includeErrorHints);

            return {
              content: [{
                type: 'text' as const,
                text: truncatedOutput
              }]
            };
          } catch (error: any) {
            console.error(`[DockerMCP] Grep error: ${error.message}`);
            return {
              content: [{
                type: 'text' as const,
                text: formatErrorWithHints(error, 'Grep', includeErrorHints)
              }],
              isError: true
            };
          }
        }
      ),
    ]
  });
}
