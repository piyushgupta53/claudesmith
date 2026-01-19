import { NextResponse } from 'next/server';
import type { OAuthProvider } from '@/lib/types/connector';
import { getProviderCredentials, getAllProviders } from '@/lib/connectors/providers';

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

/**
 * GET /api/connectors/[provider]/status
 * Check if a provider is configured (has OAuth credentials)
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { provider } = await params;

  // Validate provider
  const validProviders = getAllProviders();
  if (!validProviders.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { error: `Invalid provider: ${provider}` },
      { status: 400 }
    );
  }

  const credentials = getProviderCredentials(provider as OAuthProvider);
  const configured = credentials !== null;

  return NextResponse.json({
    provider,
    configured,
    message: configured
      ? 'Provider is configured'
      : 'Provider credentials not found in environment variables',
  });
}
