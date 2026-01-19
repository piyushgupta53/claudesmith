import { NextRequest, NextResponse } from 'next/server';
import { executorRegistry } from '@/lib/services/executorRegistry';

/**
 * POST /api/chat/[sessionId]/question
 * Handle user's answers to AskUserQuestion tool
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const { requestId, answers } = body;

    if (!requestId || !answers) {
      return NextResponse.json(
        { error: 'Missing requestId or answers field' },
        { status: 400 }
      );
    }

    // Get the executor for this session
    const executor = executorRegistry.get(sessionId);
    if (!executor) {
      return NextResponse.json(
        { error: 'No active execution found for this session' },
        { status: 404 }
      );
    }

    // Resolve the question with user's answers
    executor.resolveQuestion(requestId, answers);

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Question API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process question answers' },
      { status: 500 }
    );
  }
}
