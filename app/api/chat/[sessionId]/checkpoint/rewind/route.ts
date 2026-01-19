import { NextRequest, NextResponse } from 'next/server';
import { executorRegistry } from '@/lib/services/executorRegistry';

/**
 * POST /api/chat/[sessionId]/checkpoint/rewind
 * Rewind files to a previous checkpoint state
 *
 * Request body:
 * - messageUuid: string - The UUID of the user message to rewind to
 * - dryRun?: boolean - If true, preview changes without applying them
 *
 * Response:
 * - canRewind: boolean - Whether the rewind was/would be successful
 * - error?: string - Error message if rewind failed
 * - filesChanged?: string[] - List of files that were/would be changed
 * - insertions?: number - Number of lines inserted
 * - deletions?: number - Number of lines deleted
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { messageUuid, dryRun } = body;

  if (!messageUuid || typeof messageUuid !== 'string') {
    return NextResponse.json(
      { error: 'messageUuid is required and must be a string' },
      { status: 400 }
    );
  }

  // Get the executor for this session
  const executor = executorRegistry.get(sessionId);
  if (!executor) {
    return NextResponse.json(
      { error: 'No active session found. The session may have ended.' },
      { status: 404 }
    );
  }

  try {
    console.log(`[Checkpoint] Rewinding session ${sessionId} to ${messageUuid}${dryRun ? ' (dry run)' : ''}`);

    const result = await executor.rewindFiles(messageUuid, { dryRun: !!dryRun });

    if (result.canRewind) {
      console.log(`[Checkpoint] Rewind successful: ${result.filesChanged?.length || 0} files changed`);
    } else {
      console.log(`[Checkpoint] Rewind failed: ${result.error}`);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Checkpoint] Rewind error:', error.message);
    return NextResponse.json(
      {
        canRewind: false,
        error: error.message || 'Failed to rewind files'
      },
      { status: 500 }
    );
  }
}
