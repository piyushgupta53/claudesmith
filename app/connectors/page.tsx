'use client';

import { ConnectorManager } from '@/components/connectors/ConnectorManager';
import { Link2, Info, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConnectorsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Connectors</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect your accounts for enhanced agent capabilities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Info Banner */}
        <div className="relative overflow-hidden p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent mb-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-base text-foreground mb-1">
                Secure OAuth Connections
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connectors use OAuth 2.0 to securely link your accounts. Tokens are encrypted locally
                and never stored on external servers. You can revoke access at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Connector Cards */}
        <div className="grid gap-6">
          <ConnectorManager />
        </div>
      </div>
    </div>
  );
}
