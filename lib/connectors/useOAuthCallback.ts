'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useConnectorStore } from '@/lib/stores/connectorStore';
import { encryptTokens } from './tokenEncryption';
import type { OAuthProvider, OAuthTokens, OAuthConnection } from '../types/connector';
import { useToast } from '@/components/ui/use-toast';
import { getProviderConfig } from './providers';

interface OAuthCallbackData {
  provider: OAuthProvider;
  state: string;
  tokenData: {
    tokens: OAuthTokens;
    userInfo?: OAuthConnection['userInfo'];
    grantedScopes: string[];
  };
}

/**
 * Process OAuth callback data and store the connection
 * Uses getState() to avoid dependency on store functions
 */
async function processOAuthCallback(
  callbackData: OAuthCallbackData,
  showToast: ReturnType<typeof useToast>['toast']
): Promise<string | undefined> {
  const { provider, state, tokenData } = callbackData;
  const store = useConnectorStore.getState();

  // SECURITY: Validate state parameter to prevent CSRF attacks
  // The state must match a pending state we created - this proves the OAuth flow
  // was initiated by this application and not forged by an attacker
  const pendingState = store.getPendingState(state);
  if (!pendingState) {
    console.error('[OAuth] Invalid state parameter - rejecting callback (possible CSRF attack)');
    throw new Error('Invalid OAuth state - security validation failed');
  }
  // Clean up pending state
  store.removePendingState(state);

  // Encrypt and store tokens
  const encryptedTokenStr = await encryptTokens(tokenData.tokens);

  // Create connection record
  const connectionId = store.addConnection({
    provider,
    status: 'connected',
    userInfo: tokenData.userInfo,
    grantedScopes: tokenData.grantedScopes,
  });

  // Store encrypted tokens
  store.setEncryptedTokens(connectionId, encryptedTokenStr);

  // Show success toast
  const config = getProviderConfig(provider);
  showToast({
    variant: 'success',
    title: 'Connected!',
    description: `Successfully connected to ${config.name}`,
  });

  return connectionId;
}

/**
 * Hook to handle OAuth callback and store connection
 */
export function useOAuthCallback() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const processedRef = useRef(false);

  // Handle callback on mount
  useEffect(() => {
    // Prevent double-processing in React strict mode
    if (processedRef.current) return;

    // Check URL params for success/error
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      processedRef.current = true;
      toast({
        variant: 'destructive',
        title: 'Connection failed',
        description: errorDescription || error,
      });

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState({}, '', url.toString());
      return;
    }

    if (success === 'true') {
      // Check for OAuth callback data in sessionStorage
      const storedData = sessionStorage.getItem('oauth_callback_data');
      if (!storedData) return;

      processedRef.current = true;

      // Clear stored data immediately to prevent re-processing
      sessionStorage.removeItem('oauth_callback_data');

      // Process the callback
      (async () => {
        try {
          const callbackData: OAuthCallbackData = JSON.parse(storedData);
          await processOAuthCallback(callbackData, toast);
        } catch (err) {
          console.error('[OAuth] Failed to process callback:', err);
          toast({
            variant: 'destructive',
            title: 'Connection failed',
            description: err instanceof Error ? err.message : 'Failed to complete connection',
          });
        }
      })();

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('provider');
      url.searchParams.delete('state');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, toast]);

  // Listen for postMessage from popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // SECURITY: Validate origin to prevent XSS attacks
      // Only accept messages from the same origin (our own popup window)
      // Malicious websites cannot forge messages from our origin
      if (event.origin !== window.location.origin) {
        console.warn('[OAuth] Rejected message from untrusted origin:', event.origin);
        return;
      }

      if (event.data?.type === 'oauth_callback') {
        const { provider, state, tokenData } = event.data;

        // SECURITY: Validate state parameter for postMessage flow too
        const store = useConnectorStore.getState();
        const pendingState = store.getPendingState(state);
        if (!pendingState) {
          console.error('[OAuth] Invalid state in postMessage - rejecting (possible CSRF attack)');
          return;
        }

        try {
          // Encrypt and store tokens
          const encryptedTokenStr = await encryptTokens(tokenData.tokens);

          // Create connection record
          const connectionId = store.addConnection({
            provider,
            status: 'connected',
            userInfo: tokenData.userInfo,
            grantedScopes: tokenData.grantedScopes,
          });

          // Store encrypted tokens
          store.setEncryptedTokens(connectionId, encryptedTokenStr);

          // Clean up pending state (already validated above)
          store.removePendingState(state);

          // Show success toast
          const config = getProviderConfig(provider);
          toast({
            variant: 'success',
            title: 'Connected!',
            description: `Successfully connected to ${config.name}`,
          });
        } catch (err) {
          console.error('[OAuth] Failed to process postMessage:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);
}
