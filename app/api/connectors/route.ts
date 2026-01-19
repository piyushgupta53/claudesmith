import { NextResponse } from 'next/server';
import type { OAuthConnection } from '@/lib/types/connector';

/**
 * GET /api/connectors
 * List all OAuth connections
 *
 * Note: This endpoint is called from the client which has access to the connector store.
 * It's mainly used for server-side verification of connections.
 */
export async function GET() {
  // Connections are stored client-side in localStorage via Zustand
  // This endpoint can be used for server-side validation if needed
  return NextResponse.json({
    connections: [],
    message: 'Connections are stored client-side. Use the connector store directly.',
  });
}

/**
 * POST /api/connectors
 * Create a new connection (called after OAuth callback)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { connection } = body;

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection data is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['provider', 'status', 'grantedScopes'];
    for (const field of requiredFields) {
      if (!(field in connection)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // The actual connection is stored client-side via Zustand
    // This endpoint validates the data and returns success
    return NextResponse.json({
      success: true,
      message: 'Connection validated. Store client-side.',
    });
  } catch (error) {
    console.error('[Connectors API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process connection' },
      { status: 500 }
    );
  }
}
