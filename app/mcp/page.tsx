'use client';

import { McpManager } from '@/components/mcp/McpManager';
import { Plug2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function McpPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Plug2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">MCP Servers</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage Model Context Protocol server connections
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
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-base text-foreground mb-1">
                What are MCP Servers?
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                MCP (Model Context Protocol) servers extend your agents with external tools and data sources.
                Connect to databases, APIs, file systems, and more through standardized interfaces.
              </p>
            </div>
          </div>
        </div>

        {/* MCP Manager Component */}
        <McpManager />
      </div>
    </div>
  );
}
