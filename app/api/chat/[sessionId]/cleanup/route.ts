import { NextRequest, NextResponse } from 'next/server';
import { dockerService } from '@/lib/services/dockerService';

/**
 * DELETE /api/chat/[sessionId]/cleanup
 * Destroy Docker container for a session when the session is deleted
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    console.log(`[cleanup] Cleanup requested for session ${sessionId}`);

    const wasDestroyed = await dockerService.destroyContainerBySession(sessionId);

    if (wasDestroyed) {
      console.log(`[cleanup] Container destroyed for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        message: 'Container destroyed successfully'
      });
    } else {
      console.log(`[cleanup] No container found for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        message: 'No container found for this session'
      });
    }
  } catch (error) {
    console.error('[cleanup] Error destroying container:', error);
    return NextResponse.json(
      { error: 'Failed to destroy container' },
      { status: 500 }
    );
  }
}
