import { NextResponse } from 'next/server';
import type { OAuthProvider, OAuthTokens } from '@/lib/types/connector';
import {
  getProviderConfig,
  getProviderCredentials,
  getAllProviders,
} from '@/lib/connectors/providers';

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

/**
 * POST /api/connectors/[provider]/refresh
 * Refresh OAuth tokens
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { provider } = await params;

  try {
    // Validate provider
    const validProviders = getAllProviders();
    if (!validProviders.includes(provider as OAuthProvider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    // Get credentials
    const credentials = getProviderCredentials(provider as OAuthProvider);
    if (!credentials) {
      return NextResponse.json(
        { error: `${provider} OAuth credentials not configured` },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Get provider config
    const config = getProviderConfig(provider as OAuthProvider);

    // Build refresh token request
    const requestBody: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    };

    // Make token refresh request
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Token Refresh] Error:', error);

      // Check for specific error types
      let errorMessage = 'Failed to refresh token';
      try {
        const errorJson = JSON.parse(error);
        if (errorJson.error === 'invalid_grant') {
          errorMessage = 'Refresh token has expired. Please reconnect.';
        } else if (errorJson.error_description) {
          errorMessage = errorJson.error_description;
        }
      } catch {}

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    const data = await response.json();

    // Build new tokens object
    const newTokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
      tokenType: data.token_type || 'bearer',
      expiresAt: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
      scope: data.scope,
    };

    return NextResponse.json({
      success: true,
      tokens: newTokens,
      expiresAt: newTokens.expiresAt,
    });
  } catch (error) {
    console.error('[Token Refresh] Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
