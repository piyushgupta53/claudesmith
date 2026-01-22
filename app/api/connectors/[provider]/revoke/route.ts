import { NextResponse } from 'next/server';
import {
  validateOAuthProvider,
  validationErrorResponse,
} from '@/lib/utils/oauthMiddleware';

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

/**
 * POST /api/connectors/[provider]/revoke
 * Revoke OAuth tokens
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { provider: providerParam } = await params;

  try {
    // Validate provider and get configuration
    const validation = validateOAuthProvider(providerParam);
    if (!validation.valid) {
      return validationErrorResponse(validation);
    }

    const { provider, credentials, config } = validation;

    // Parse request body
    const body = await request.json();
    const { accessToken, refreshToken, connectionId } = body;

    // Not all providers support token revocation
    if (!config.revokeUrl) {
      // For providers without revoke endpoint (like Notion),
      // just return success - tokens will be removed client-side
      return NextResponse.json({
        success: true,
        message: `${provider} does not support token revocation. Tokens removed locally.`,
      });
    }

    // Attempt to revoke token
    try {
      const tokenToRevoke = accessToken || refreshToken;
      if (!tokenToRevoke) {
        // No token to revoke, just return success
        return NextResponse.json({
          success: true,
          message: 'No token to revoke',
        });
      }

      // Provider-specific revocation
      switch (provider) {
        case 'google': {
          // Google uses a simple GET request with token parameter
          const revokeUrl = `${config.revokeUrl}?token=${encodeURIComponent(tokenToRevoke)}`;
          const response = await fetch(revokeUrl, {
            method: 'POST',
          });

          if (!response.ok && response.status !== 400) {
            // 400 often means token already revoked, which is fine
            console.error('[Token Revoke] Google error:', await response.text());
          }
          break;
        }

        case 'slack': {
          // Slack uses an API endpoint with the token
          const response = await fetch(config.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: tokenToRevoke,
            }),
          });

          const data = await response.json();
          if (!data.ok && data.error !== 'invalid_auth') {
            console.error('[Token Revoke] Slack error:', data.error);
          }
          break;
        }

        case 'github': {
          // GitHub uses a DELETE request with Basic auth
          // The token is in the request body
          const revokeUrl = config.revokeUrl.replace(
            '{client_id}',
            credentials.clientId
          );

          const response = await fetch(revokeUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${btoa(
                `${credentials.clientId}:${credentials.clientSecret}`
              )}`,
              Accept: 'application/vnd.github+json',
            },
            body: JSON.stringify({
              access_token: tokenToRevoke,
            }),
          });

          if (!response.ok && response.status !== 404) {
            // 404 means token doesn't exist, which is fine
            console.error('[Token Revoke] GitHub error:', await response.text());
          }
          break;
        }

        default:
          // Generic revocation attempt
          const response = await fetch(config.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: tokenToRevoke,
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
            }),
          });

          if (!response.ok) {
            console.error(
              '[Token Revoke] Generic error:',
              await response.text()
            );
          }
      }
    } catch (revokeError) {
      // Log but don't fail - token may already be invalid
      console.error('[Token Revoke] Error during revocation:', revokeError);
    }

    return NextResponse.json({
      success: true,
      message: 'Token revoked successfully',
    });
  } catch (error) {
    console.error('[Token Revoke] Error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke token' },
      { status: 500 }
    );
  }
}
