import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/chat/[sessionId]/permission
 * Handle permission approval/denial for tool execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const { requestId, approved } = body;

    if (!requestId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing requestId or approved field' },
        { status: 400 }
      );
    }

    // In a real implementation, this would communicate with the running agent execution
    // For now, we'll store the response and let the streaming endpoint pick it up
    // This is a simplified implementation - in production you'd use a message queue or pub/sub

    return NextResponse.json({
      success: true,
      requestId,
      approved,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Permission API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process permission' },
      { status: 500 }
    );
  }
}
