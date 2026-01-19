/**
 * Read Tool
 *
 * Reads files from allowed directories (/project, /scratch, /skills)
 * Supports text files, with optional line offset and limit
 */

import { dockerService } from '../services/dockerService';
import { validateReadPath } from '../utils/pathValidator';

export interface ReadToolInput {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadToolOutput {
  content: string;
  totalLines: number;
  displayedLines: number;
  path: string;
}

/**
 * Read tool implementation
 * Reads files from container with validation
 */
export async function readTool(
  input: ReadToolInput,
  context: { containerId?: string }
): Promise<ReadToolOutput> {
  // Validate path
  const validation = validateReadPath(input.path);
  if (!validation.valid) {
    throw new Error(`Read failed: ${validation.error}`);
  }

  const normalizedPath = validation.sanitized!;

  // Check if container ID is provided
  if (!context.containerId) {
    throw new Error('Read tool requires Docker container but none is available');
  }

  try {
    // Read file from container
    const content = await dockerService.readFile(
      context.containerId,
      normalizedPath
    );

    // Split into lines
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Apply offset and limit if specified
    const offset = input.offset || 0;
    const limit = input.limit || totalLines;
    const end = Math.min(offset + limit, totalLines);

    // Extract requested lines
    const displayedLines = lines.slice(offset, end);

    // Add line numbers (1-indexed)
    const numberedLines = displayedLines.map((line, index) => {
      const lineNumber = offset + index + 1;
      return `${lineNumber.toString().padStart(6, ' ')}\t${line}`;
    });

    return {
      content: numberedLines.join('\n'),
      totalLines,
      displayedLines: displayedLines.length,
      path: normalizedPath
    };
  } catch (error: any) {
    throw new Error(`Failed to read file ${normalizedPath}: ${error.message}`);
  }
}

/**
 * Tool schema for Claude Agent SDK
 */
export const readToolSchema = {
  name: 'Read',
  description: `Read a file from the filesystem. Supports files in /project (user files), /scratch (temporary workspace), and /skills (agent skills).

Usage:
- Read entire file: Read({ path: "/project/README.md" })
- Read specific lines: Read({ path: "/project/data.txt", offset: 10, limit: 20 })

Returns file content with line numbers for easy reference.`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to file within /project, /scratch, or /skills'
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (0-indexed, optional)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read (optional)'
      }
    },
    required: ['path']
  }
};
