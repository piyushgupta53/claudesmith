import { NextRequest, NextResponse } from 'next/server';

// Store active executors (in production, use Redis or similar)
const activeExecutors = new Map<string, any>();

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

    const executor = activeExecutors.get(sessionId);

    if (!executor) {
      return NextResponse.json(
        { error: 'No active execution found for this session' },
        { status: 404 }
      );
    }

    await executor.interrupt();
    activeExecutors.delete(sessionId);

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
