import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/chat
 * Create a new chat session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, agentName, initialMessage } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Generate unique session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create session object
    const session = {
      id: sessionId,
      agentId,
      agentName: agentName || 'Agent',
      title: initialMessage?.substring(0, 50) || 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      status: 'active' as const,
    };

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    );
  }
}
