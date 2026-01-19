/**
 * Write Tool
 *
 * Writes files to /scratch directory only (read-write workspace)
 * Automatically creates parent directories if needed
 */

import { dockerService } from '../services/dockerService';
import { validateWritePath, getDirectory } from '../utils/pathValidator';

export interface WriteToolInput {
  path: string;
  content: string;
}

export interface WriteToolOutput {
  path: string;
  bytesWritten: number;
  directory: string;
}

/**
 * Write tool implementation
 * Writes files to container /scratch directory with validation
 */
export async function writeTool(
  input: WriteToolInput,
  context: { containerId?: string }
): Promise<WriteToolOutput> {
  // Validate path (must be in /scratch)
  const validation = validateWritePath(input.path);
  if (!validation.valid) {
    throw new Error(`Write failed: ${validation.error}`);
  }

  const normalizedPath = validation.sanitized!;

  // Check if container ID is provided
  if (!context.containerId) {
    throw new Error('Write tool requires Docker container but none is available');
  }

  try {
    // Write file to container
    await dockerService.writeFile(
      context.containerId,
      normalizedPath,
      input.content
    );

    // Calculate bytes written
    const bytesWritten = Buffer.byteLength(input.content, 'utf8');

    // Get directory
    const directory = getDirectory(normalizedPath);

    return {
      path: normalizedPath,
      bytesWritten,
      directory
    };
  } catch (error: any) {
    throw new Error(`Failed to write file ${normalizedPath}: ${error.message}`);
  }
}

/**
 * Tool schema for Claude Agent SDK
 */
export const writeToolSchema = {
  name: 'Write',
  description: `Write content to a file in the /scratch directory (temporary workspace). Use this to store intermediate results, analysis findings, or any data you want to persist during the session.

IMPORTANT: Can only write to /scratch directory. Cannot write to /project (read-only) or /skills (read-only).

Usage:
- Write text file: Write({ path: "/scratch/notes.txt", content: "My notes here" })
- Write JSON data: Write({ path: "/scratch/results.json", content: JSON.stringify(data) })
- Write to subdirectory: Write({ path: "/scratch/analysis/report.md", content: "# Report" })

Parent directories are created automatically if they don't exist.`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path within /scratch directory where file will be written'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      }
    },
    required: ['path', 'content']
  }
};
