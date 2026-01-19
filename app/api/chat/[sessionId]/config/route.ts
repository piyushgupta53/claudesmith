import { NextRequest, NextResponse } from 'next/server';
import { sessionConfigStore } from '@/lib/services/sessionConfigStore';

/**
 * POST /api/chat/[sessionId]/config
 * Store agent config for a session before starting the stream.
 * This avoids URL length limits for large agent configs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  try {
    const body = await request.json();
    const { agentConfig, prompt } = body;

    if (!agentConfig) {
      return NextResponse.json(
        { error: 'Missing agentConfig' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      );
    }

    // Store the config
    sessionConfigStore.store(sessionId, agentConfig, prompt);

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Config stored successfully',
    });
  } catch (error: any) {
    console.error('[Config API] Error storing config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to store config' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/[sessionId]/config
 * Clear stored config for a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  sessionConfigStore.clear(sessionId);

  return NextResponse.json({
    success: true,
    sessionId,
    message: 'Config cleared',
  });
}
