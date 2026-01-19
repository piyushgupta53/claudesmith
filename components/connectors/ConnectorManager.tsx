'use client';

import { useState, useEffect, Suspense } from 'react';
import { useConnectorStore } from '@/lib/stores/connectorStore';
import { PROVIDER_CONFIGS, getAllProviders } from '@/lib/connectors/providers';
import { useOAuthCallback } from '@/lib/connectors/useOAuthCallback';
import { ConnectorCard, ProviderCard } from './ConnectorCard';
import { ConnectorScopeDialog } from './ConnectorScopeDialog';
import { useToast } from '@/components/ui/use-toast';
import { Plug, AlertCircle } from 'lucide-react';
import type { OAuthProvider } from '@/lib/types/connector';

function ConnectorManagerContent() {
  const { connections, deleteConnection, updateConnection } = useConnectorStore();
  const { toast } = useToast();

  // Handle OAuth callback (processes URL params and sessionStorage data)
  useOAuthCallback();

  // UI state
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [refreshingConnection, setRefreshingConnection] = useState<string | null>(null);
  const [scopeDialogProvider, setScopeDialogProvider] = useState<OAuthProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [providerConfigStatus, setProviderConfigStatus] = useState<Record<OAuthProvider, boolean>>({} as any);

  // Get connections list
  const connectionsList = Array.from(connections.values());
  const connectedProviders = new Set(
    connectionsList
      .filter((c) => c.status === 'connected')
      .map((c) => c.provider)
  );

  // Providers that can still be connected (not already connected)
  const allProviders = getAllProviders();
  const availableProviders = allProviders.filter(
    (p) => !connectedProviders.has(p)
  );

  // Check provider configuration status on mount
  useEffect(() => {
    const providers = getAllProviders();

    const checkProviderConfig = async () => {
      const status: Record<OAuthProvider, boolean> = {} as any;
      for (const provider of providers) {
        try {
          // Check via API since env vars are server-side only
          const response = await fetch(`/api/connectors/${provider}/status`);
          if (response.ok) {
            const data = await response.json();
            status[provider] = data.configured;
          } else {
            status[provider] = false;
          }
        } catch {
          status[provider] = false;
        }
      }
      setProviderConfigStatus(status);
    };

    checkProviderConfig();
  }, []);

  // Cleanup expired OAuth states periodically (separate effect to avoid re-running on store changes)
  useEffect(() => {
    // Initial cleanup
    useConnectorStore.getState().cleanupExpiredStates();

    // Periodic cleanup
    const interval = setInterval(() => {
      useConnectorStore.getState().cleanupExpiredStates();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Handle connect button click
  const handleConnect = (provider: OAuthProvider) => {
    setScopeDialogProvider(provider);
  };

  // Handle scope dialog confirm
  const handleScopeConfirm = async (scopes: string[]) => {
    if (!scopeDialogProvider) return;

    setIsConnecting(true);

    try {
      // Call authorize endpoint to start OAuth flow
      const response = await fetch(`/api/connectors/${scopeDialogProvider}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start authorization');
      }

      const { authorizationUrl } = await response.json();

      // Redirect to OAuth provider
      window.location.href = authorizationUrl;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to start OAuth flow',
      });
      setIsConnecting(false);
      setScopeDialogProvider(null);
    }
  };

  // Handle disconnect
  const handleDisconnect = async (id: string) => {
    if (disconnectConfirm === id) {
      const connection = connections.get(id);
      if (!connection) return;

      try {
        // Call revoke endpoint
        await fetch(`/api/connectors/${connection.provider}/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: id }),
        });
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }

      // Remove from store
      deleteConnection(id);
      setDisconnectConfirm(null);

      toast({
        variant: 'success',
        title: 'Disconnected',
        description: `${PROVIDER_CONFIGS[connection.provider].name} has been disconnected.`,
      });
    } else {
      setDisconnectConfirm(id);
      setTimeout(() => setDisconnectConfirm(null), 3000);
    }
  };

  // Handle refresh tokens
  const handleRefresh = async (id: string) => {
    const connection = connections.get(id);
    if (!connection) return;

    setRefreshingConnection(id);

    try {
      const response = await fetch(`/api/connectors/${connection.provider}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh token');
      }

      const data = await response.json();

      updateConnection(id, {
        status: 'connected',
        errorMessage: undefined,
      });

      toast({
        variant: 'success',
        title: 'Token refreshed',
        description: `${PROVIDER_CONFIGS[connection.provider].name} connection has been refreshed.`,
      });
    } catch (error) {
      updateConnection(id, {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Failed to refresh token',
      });

      toast({
        variant: 'destructive',
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'Failed to refresh token',
      });
    } finally {
      setRefreshingConnection(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plug className="w-5 h-5" />
            OAuth Connectors
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect to external services to give your agents access to Gmail, Drive, Slack, and more
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What are OAuth Connectors?
            </h4>
            <p className="text-xs text-muted-foreground">
              OAuth connectors allow agents to securely access your accounts on external services.
              Click &quot;Connect&quot; to authorize access. Your credentials are never stored - only
              access tokens that can be revoked at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Connected Services */}
      {connectionsList.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Connected Services</h3>
          <div className="grid gap-4">
            {connectionsList.map((connection) => (
              <ConnectorCard
                key={connection.id}
                connection={connection}
                onDisconnect={() => handleDisconnect(connection.id)}
                onRefresh={() => handleRefresh(connection.id)}
                disconnectConfirm={disconnectConfirm === connection.id}
                isRefreshing={refreshingConnection === connection.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available to Connect */}
      {availableProviders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">
            {connectionsList.length > 0 ? 'Add More Connections' : 'Available Services'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {availableProviders.map((provider) => (
              <ProviderCard
                key={provider}
                config={PROVIDER_CONFIGS[provider]}
                onConnect={() => handleConnect(provider)}
                isConnecting={isConnecting && scopeDialogProvider === provider}
                isConfigured={providerConfigStatus[provider] ?? false}
              />
            ))}
          </div>
        </div>
      )}

      {/* All connected state */}
      {availableProviders.length === 0 && connectionsList.length > 0 && (
        <div className="border border-border rounded-lg p-8 text-center">
          <Plug className="w-12 h-12 mx-auto text-primary mb-4" />
          <h3 className="font-semibold mb-2">All services connected!</h3>
          <p className="text-sm text-muted-foreground">
            You&apos;ve connected all available OAuth services.
          </p>
        </div>
      )}

      {/* Scope Selection Dialog */}
      <ConnectorScopeDialog
        open={!!scopeDialogProvider}
        onClose={() => setScopeDialogProvider(null)}
        provider={scopeDialogProvider}
        onConfirm={handleScopeConfirm}
        isLoading={isConnecting}
      />
    </div>
  );
}

/**
 * Wrapper with Suspense for useSearchParams
 */
export function ConnectorManager() {
  return (
    <Suspense fallback={<ConnectorManagerSkeleton />}>
      <ConnectorManagerContent />
    </Suspense>
  );
}

function ConnectorManagerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded mt-2 animate-pulse" />
        </div>
      </div>
      <div className="h-20 bg-muted/50 rounded-lg animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
