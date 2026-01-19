import { NextRequest, NextResponse } from 'next/server';
import dockerService from '@/lib/services/dockerService';
import { validateReadPath } from '@/lib/utils/pathValidator';
import { FileInfo } from '@/lib/types/container';

/**
 * Maximum file size to return content for (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum depth for recursive file listing
 */
const MAX_DEPTH = 3;

/**
 * Extended FileInfo with children for tree structure
 */
interface FileInfoWithChildren extends FileInfo {
  children?: FileInfoWithChildren[];
}

/**
 * Recursively list files in a directory
 * Builds a tree structure with nested children
 */
async function listFilesRecursive(
  containerId: string,
  dirPath: string,
  currentDepth: number = 0
): Promise<FileInfoWithChildren[]> {
  if (currentDepth >= MAX_DEPTH) {
    return [];
  }

  try {
    const files = await dockerService.listFiles(containerId, dirPath);
    const result: FileInfoWithChildren[] = [];

    for (const file of files) {
      // Skip the directory itself (find includes the base dir)
      if (file.path === dirPath) {
        continue;
      }

      const fileWithChildren: FileInfoWithChildren = { ...file };

      // Recursively get children for directories
      if (file.type === 'directory') {
        fileWithChildren.children = await listFilesRecursive(
          containerId,
          file.path,
          currentDepth + 1
        );
      }

      result.push(fileWithChildren);
    }

    // Sort: directories first, then by name
    result.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch (error) {
    console.error(`Failed to list files in ${dirPath}:`, error);
    return [];
  }
}

/**
 * GET /api/chat/[sessionId]/files
 *
 * Query parameters:
 * - path: Directory to list or file to read (default: /scratch)
 * - action: 'list' (default) or 'content' (to fetch file content)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/scratch';
    const action = searchParams.get('action') || 'list';

    // Validate path using security validator
    const validation = validateReadPath(path);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const sanitizedPath = validation.sanitized || path;

    // Check if container exists for this session
    const containerId = dockerService.getContainerIdForSession(sessionId);
    console.log(`[Files API] Session ${sessionId}: containerId=${containerId || 'none'}`);

    if (!containerId) {
      console.log(`[Files API] No container found for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        containerActive: false,
        files: [],
        message: 'No container started for this session yet'
      });
    }

    // Verify container is running
    try {
      const status = await dockerService.getContainerStatus(containerId);
      if (status.state !== 'running') {
        return NextResponse.json({
          success: true,
          containerActive: false,
          files: [],
          message: 'Container is not running'
        });
      }
    } catch (error) {
      return NextResponse.json({
        success: true,
        containerActive: false,
        files: [],
        message: 'Container not accessible'
      });
    }

    if (action === 'content') {
      // Fetch file content
      try {
        // First check file size using stat
        const statResult = await dockerService.executeCommand(
          containerId,
          `stat -c '%s' "${sanitizedPath}" 2>/dev/null || echo '-1'`,
          '/tmp',
          5000
        );

        const fileSize = parseInt(statResult.stdout.trim(), 10);

        if (fileSize === -1) {
          return NextResponse.json(
            { success: false, error: 'File not found' },
            { status: 404 }
          );
        }

        if (fileSize > MAX_FILE_SIZE) {
          return NextResponse.json({
            success: true,
            containerActive: true,
            content: null,
            truncated: true,
            fileSize,
            message: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
          });
        }

        const content = await dockerService.readFile(containerId, sanitizedPath);

        return NextResponse.json({
          success: true,
          containerActive: true,
          content,
          fileSize
        });
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to read file' },
          { status: 500 }
        );
      }
    } else {
      // List files recursively
      try {
        // Build the tree structure starting from the requested path
        console.log(`[Files API] Listing files in ${sanitizedPath} for container ${containerId.substring(0, 12)}`);
        const files = await listFilesRecursive(containerId, sanitizedPath);
        console.log(`[Files API] Found ${files.length} items in ${sanitizedPath}`);

        // If listing /scratch, wrap in a root node for UI consistency
        const rootFiles: FileInfoWithChildren[] = sanitizedPath === '/scratch' ? [
          {
            path: '/scratch',
            name: 'scratch',
            type: 'directory' as const,
            size: 0,
            modified: new Date().toISOString(),
            children: files
          }
        ] : files;

        return NextResponse.json({
          success: true,
          containerActive: true,
          files: rootFiles
        });
      } catch (error: any) {
        console.error(`[Files API] Error listing files:`, error);
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to list files' },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error in files API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
