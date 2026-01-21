import { NextRequest, NextResponse } from 'next/server';
import { executorRegistry } from '@/lib/services/executorRegistry';

/**
 * POST /api/chat/[sessionId]/interrupt
 * Interrupt a running agent execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    const executor = executorRegistry.get(sessionId);

    if (!executor) {
      console.log(`[Interrupt] No active executor found for session: ${sessionId}`);
      console.log(`[Interrupt] Active sessions: ${executorRegistry.listSessions().join(', ') || 'none'}`);
      return NextResponse.json(
        { error: 'No active execution found for this session' },
        { status: 404 }
      );
    }

    console.log(`[Interrupt] Interrupting execution for session: ${sessionId}`);

    // Interrupt the query instance and cleanup container
    await executor.interrupt();

    // Destroy the container
    await executor.destroy();

    // Unregister from the global registry
    executorRegistry.unregister(sessionId);

    console.log(`[Interrupt] Successfully interrupted and cleaned up session: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Execution interrupted successfully'
    });
  } catch (error) {
    console.error('Error interrupting execution:', error);
    return NextResponse.json(
      { error: 'Failed to interrupt execution' },
      { status: 500 }
    );
  }
}
