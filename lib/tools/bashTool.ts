/**
 * Bash Tool
 *
 * Executes safe bash commands in Docker container
 * Validates commands against whitelist before execution
 */

import { dockerService } from '../services/dockerService';
import { validateBashCommand, getAllowedCommands } from '../utils/commandValidator';

export interface BashToolInput {
  command: string;
  cwd?: string;
  timeout?: number;
}

export interface BashToolOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  command: string;
}

/**
 * Bash tool implementation
 * Executes validated commands in container
 */
export async function bashTool(
  input: BashToolInput,
  context: { containerId?: string }
): Promise<BashToolOutput> {
  // Validate command
  const validation = validateBashCommand(input.command);
  if (!validation.valid) {
    throw new Error(`Command blocked: ${validation.error}`);
  }

  const sanitizedCommand = validation.sanitized!;

  // Check if container ID is provided
  if (!context.containerId) {
    throw new Error('Bash tool requires Docker container but none is available');
  }

  // Set working directory (default to /scratch)
  const cwd = input.cwd || '/scratch';

  // Validate working directory is safe
  if (!cwd.startsWith('/project') && !cwd.startsWith('/scratch') && !cwd.startsWith('/skills')) {
    throw new Error(`Working directory must be within /project, /scratch, or /skills. Got: ${cwd}`);
  }

  // Set timeout (default 30 seconds, max 60 seconds)
  const timeout = Math.min(input.timeout || 30000, 60000);

  try {
    // Execute command in container
    const result = await dockerService.executeCommand(
      context.containerId,
      sanitizedCommand,
      cwd,
      timeout
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
      command: sanitizedCommand
    };
  } catch (error: any) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

/**
 * Tool schema for Claude Agent SDK
 */
export const bashToolSchema = {
  name: 'Bash',
  description: `Execute safe bash commands in an isolated container. Use this to analyze files, process data, search for patterns, and compose operations.

ALLOWED COMMANDS:
${getAllowedCommands().join(', ')}

BLOCKED COMMANDS:
- File modification: rm, mv, cp, mkdir (use Write tool instead)
- System commands: sudo, apt, systemctl
- Package managers: npm, pip, cargo
- Network: ssh, ftp, wget (except curl for HTTPS)

SAFE PATTERNS:
- Inspect files: ls /project, cat /project/file.txt, stat /project/file.txt
- Search: grep "pattern" /project/file.txt, find /project -name "*.ts"
- Process data: cat data.txt | grep error | sort | uniq -c
- JSON: jq '.key' /project/data.json
- Store results: Use pipes with > /scratch/output.txt (not to /project)

TIPS:
- Chain commands with pipes: cat file | grep pattern | wc -l
- Store intermediate results in /scratch for reuse
- Use head/tail to limit output for large files
- Check exit codes in stdout/stderr for errors`,
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Bash command to execute (must use only allowed commands)'
      },
      cwd: {
        type: 'string',
        description: 'Working directory (default: /scratch, must be within /project, /scratch, or /skills)'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000, max: 60000)'
      }
    },
    required: ['command']
  }
};
