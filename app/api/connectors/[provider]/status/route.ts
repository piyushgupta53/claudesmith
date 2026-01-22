import { NextResponse } from 'next/server';
import {
  validateOAuthProvider,
} from '@/lib/utils/oauthMiddleware';

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
  const { provider: providerParam } = await params;

  // Validate provider and get configuration
  const validation = validateOAuthProvider(providerParam);

  // For status endpoint, we differentiate between invalid provider and unconfigured
  if (!validation.valid) {
    // Check if it's an invalid provider (not just missing credentials)
    if (validation.error.includes('Invalid provider')) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    // Provider is valid but not configured
    return NextResponse.json({
      provider: providerParam,
      configured: false,
      message: 'Provider credentials not found in environment variables',
    });
  }

  // Provider is configured
  return NextResponse.json({
    provider: validation.provider,
    configured: true,
    message: 'Provider is configured',
  });
}
