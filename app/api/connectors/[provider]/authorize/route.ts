import { NextResponse } from 'next/server';
import type { OAuthProvider, OAuthState } from '@/lib/types/connector';
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
 * Generate secure random string for state parameter
 */
function generateStateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate PKCE code challenge from verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * POST /api/connectors/[provider]/authorize
 * Start OAuth flow - returns authorization URL
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { provider: providerParam } = await params;

  try {
    // Validate provider and get configuration
    const validation = validateOAuthProvider(providerParam);
    if (!validation.valid) {
      return validationErrorResponse(validation);
    }

    const { provider, credentials, config, redirectUri } = validation;

    // Parse request body
    const body = await request.json();
    const { scopes = [] } = body;

    // Generate state and PKCE
    const stateNonce = generateStateNonce();
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (config.supportsPKCE) {
      codeVerifier = generateCodeVerifier();
      codeChallenge = await generateCodeChallenge(codeVerifier);
    }

    // Build OAuth state (to be stored client-side)
    const oauthState: OAuthState = {
      provider,
      redirectUri,
      codeVerifier,
      scopes,
      timestamp: Date.now(),
      nonce: stateNonce,
    };

    // Build authorization URL
    const authUrl = new URL(config.authorizationUrl);

    // Standard OAuth parameters
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', config.responseType);
    authUrl.searchParams.set('state', stateNonce);

    // Add scopes (if any)
    const requestScopes = scopes.length > 0 ? scopes : config.defaultScopes;
    if (requestScopes.length > 0) {
      // Different providers use different scope formats
      if (provider === 'slack') {
        // Slack uses 'scope' for bot scopes
        authUrl.searchParams.set('scope', requestScopes.join(','));
      } else if (provider === 'notion') {
        // Notion doesn't use scopes in the authorization URL
        // Access is determined by the pages shared with the integration
      } else {
        // Google, GitHub use space-separated scopes
        authUrl.searchParams.set('scope', requestScopes.join(' '));
      }
    }

    // Add PKCE if supported
    if (config.supportsPKCE && codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    // Add provider-specific parameters
    if (config.additionalAuthParams) {
      Object.entries(config.additionalAuthParams).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });
    }

    return NextResponse.json({
      authorizationUrl: authUrl.toString(),
      state: stateNonce,
      oauthState, // Client should store this to validate callback
    });
  } catch (error) {
    console.error('[OAuth Authorize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start authorization' },
      { status: 500 }
    );
  }
}
