/**
 * OAuth Middleware Utilities
 *
 * Centralized validation and helper functions for OAuth routes.
 * Eliminates code duplication across authorize, callback, refresh, revoke, and status routes.
 */

import { NextResponse } from 'next/server';
import type { OAuthProvider } from '../types/connector';
import {
  getAllProviders,
  getProviderCredentials,
  getProviderConfig,
  getRedirectUri,
} from '../connectors/providers';

/**
 * Result of OAuth provider validation
 */
export interface OAuthValidationResult {
  valid: true;
  provider: OAuthProvider;
  credentials: { clientId: string; clientSecret: string };
  config: ReturnType<typeof getProviderConfig>;
  redirectUri: string;
}

export interface OAuthValidationError {
  valid: false;
  error: string;
  status: number;
}

/**
 * Validate an OAuth provider and get all related configuration.
 * Returns a validated result with credentials and config, or an error.
 *
 * @param providerParam - The provider string from route params
 * @returns Validation result with all necessary OAuth data, or error
 *
 * @example
 * const validation = validateOAuthProvider(provider);
 * if (!validation.valid) {
 *   return NextResponse.json({ error: validation.error }, { status: validation.status });
 * }
 * // Use validation.credentials, validation.config, etc.
 */
export function validateOAuthProvider(
  providerParam: string
): OAuthValidationResult | OAuthValidationError {
  // Validate provider name
  const validProviders = getAllProviders();
  if (!validProviders.includes(providerParam as OAuthProvider)) {
    return {
      valid: false,
      error: `Invalid provider: ${providerParam}`,
      status: 400,
    };
  }

  const provider = providerParam as OAuthProvider;

  // Check credentials are configured
  const credentials = getProviderCredentials(provider);
  if (!credentials) {
    return {
      valid: false,
      error: `${provider} OAuth credentials not configured`,
      status: 400,
    };
  }

  // Get provider config and redirect URI
  const config = getProviderConfig(provider);
  const redirectUri = getRedirectUri(provider);

  return {
    valid: true,
    provider,
    credentials,
    config,
    redirectUri,
  };
}

/**
 * Create a standardized error response for OAuth routes.
 *
 * @param error - Error message
 * @param status - HTTP status code
 * @returns NextResponse with JSON error
 */
export function oauthErrorResponse(error: string, status: number = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Helper to return validation error as NextResponse.
 * Use when validateOAuthProvider returns an error.
 *
 * @param validation - The validation error result
 * @returns NextResponse with error
 */
export function validationErrorResponse(
  validation: OAuthValidationError
): NextResponse {
  return oauthErrorResponse(validation.error, validation.status);
}
