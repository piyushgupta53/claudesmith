import { NextResponse } from 'next/server';
import type { OAuthProvider, OAuthTokens, OAuthConnection } from '@/lib/types/connector';
import { getProviderConfig } from '@/lib/connectors/providers';
import {
  validateOAuthProvider,
} from '@/lib/utils/oauthMiddleware';

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

/**
 * GET /api/connectors/[provider]/callback
 * OAuth callback handler - exchanges code for tokens
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);

  // Extract OAuth callback parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Build redirect URL to settings page with result
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const settingsUrl = new URL('/settings', baseUrl);

  // Handle OAuth errors
  if (error) {
    settingsUrl.searchParams.set('error', error);
    if (errorDescription) {
      settingsUrl.searchParams.set('error_description', errorDescription);
    }
    return NextResponse.redirect(settingsUrl.toString());
  }

  // Validate required parameters
  if (!code || !state) {
    settingsUrl.searchParams.set('error', 'missing_params');
    settingsUrl.searchParams.set('error_description', 'Missing code or state parameter');
    return NextResponse.redirect(settingsUrl.toString());
  }

  // Validate provider using centralized middleware
  const validation = validateOAuthProvider(provider);
  if (!validation.valid) {
    settingsUrl.searchParams.set('error', validation.status === 400 && validation.error.includes('credentials')
      ? 'not_configured'
      : 'invalid_provider');
    return NextResponse.redirect(settingsUrl.toString());
  }

  try {
    const { credentials, config, redirectUri, provider: validatedProvider } = validation;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      validatedProvider,
      code,
      redirectUri,
      credentials
    );

    // Fetch user info if available
    let userInfo: OAuthConnection['userInfo'] | undefined;
    if (config.userInfoUrl) {
      userInfo = await fetchUserInfo(validatedProvider, tokens.accessToken);
    }

    // Build success redirect with token data
    // Note: Tokens are passed via URL fragment for security (not sent to server on redirect)
    settingsUrl.searchParams.set('success', 'true');
    settingsUrl.searchParams.set('provider', provider);
    settingsUrl.searchParams.set('state', state);

    // Pass token data as base64-encoded JSON in fragment
    const tokenData = {
      tokens,
      userInfo,
      grantedScopes: tokens.scope ? tokens.scope.split(/[\s,]+/) : [],
    };

    // SECURITY: Escape JSON for safe embedding in HTML script tags
    // This prevents XSS attacks where OAuth provider data could contain </script>
    // or other sequences that break out of the script context
    const escapeForHtml = (str: string) => str
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027')
      .replace(/"/g, '\\u0022');

    const safeTokenData = escapeForHtml(JSON.stringify(tokenData));
    const safeState = escapeForHtml(JSON.stringify(state));
    const safeProvider = escapeForHtml(JSON.stringify(provider));
    const safeSettingsUrl = escapeForHtml(settingsUrl.toString());
    const safeProviderDisplay = escapeForHtml(provider);

    // Return HTML that passes data to client-side JavaScript
    // SECURITY: postMessage uses window.location.origin to prevent cross-origin attacks
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Connecting...</title>
</head>
<body>
  <script>
    // Store token data and redirect
    const tokenData = ${safeTokenData};
    const state = ${safeState};
    const provider = ${safeProvider};

    // Dispatch custom event for the app to handle
    // SECURITY: Use specific origin instead of '*' to prevent cross-origin attacks
    if (window.opener) {
      window.opener.postMessage({
        type: 'oauth_callback',
        provider,
        state,
        tokenData,
      }, window.location.origin);
    }

    // Also store in sessionStorage as fallback
    sessionStorage.setItem('oauth_callback_data', JSON.stringify({
      provider,
      state,
      tokenData,
    }));

    // Redirect to settings page
    window.location.href = '${safeSettingsUrl}';
  </script>
  <p>Connecting to ${safeProviderDisplay}...</p>
</body>
</html>
`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('[OAuth Callback] Error:', error);
    settingsUrl.searchParams.set('error', 'exchange_failed');
    settingsUrl.searchParams.set(
      'error_description',
      error instanceof Error ? error.message : 'Token exchange failed'
    );
    return NextResponse.redirect(settingsUrl.toString());
  }
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  credentials: { clientId: string; clientSecret: string }
): Promise<OAuthTokens> {
  const config = getProviderConfig(provider);

  // Build token request body
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  };

  // Provider-specific handling
  let headers: HeadersInit = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (provider === 'github') {
    // GitHub requires Accept header for JSON response
    headers['Accept'] = 'application/json';
  }

  if (provider === 'notion') {
    // Notion uses Basic auth for token endpoint
    const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
    };

    // Notion uses JSON body
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      tokenType: data.token_type || 'bearer',
      scope: data.scope,
    };
  }

  // Standard OAuth token exchange
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'bearer',
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
    scope: data.scope,
  };
}

/**
 * Fetch user info from provider
 */
async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthConnection['userInfo']> {
  const config = getProviderConfig(provider);
  if (!config.userInfoUrl) return undefined;

  try {
    let url = config.userInfoUrl;
    let headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
    };

    // Provider-specific handling
    if (provider === 'slack') {
      // Slack uses a different endpoint format
      url = 'https://slack.com/api/users.identity';
      headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
    }

    if (provider === 'notion') {
      // Notion uses a specific version header
      headers['Notion-Version'] = '2022-06-28';
      // Notion user info comes from /users/me
      url = 'https://api.notion.com/v1/users/me';
    }

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      console.error('[UserInfo] Failed to fetch:', await response.text());
      return undefined;
    }

    const data = await response.json();

    // Parse response based on provider
    switch (provider) {
      case 'google':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.picture,
        };

      case 'slack':
        return {
          id: data.user?.id,
          name: data.user?.name,
          email: data.user?.email,
          avatar: data.user?.image_48,
        };

      case 'notion':
        return {
          id: data.id,
          name: data.name,
          email: data.person?.email,
          avatar: data.avatar_url,
        };

      case 'github':
        return {
          id: String(data.id),
          name: data.name || data.login,
          email: data.email,
          avatar: data.avatar_url,
        };

      default:
        return {
          id: data.id,
          name: data.name,
          email: data.email,
        };
    }
  } catch (error) {
    console.error('[UserInfo] Error:', error);
    return undefined;
  }
}
