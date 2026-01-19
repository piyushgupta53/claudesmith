'use client';

import { Activity, HardDrive, Cpu, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContainerStatus {
  state: 'created' | 'running' | 'stopped' | 'error';
  uptime?: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

interface SandboxStatusProps {
  status: ContainerStatus;
}

export function SandboxStatus({ status }: SandboxStatusProps) {
  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusColor = (state: ContainerStatus['state']) => {
    switch (state) {
      case 'running':
        return 'text-success';
      case 'created':
        return 'text-primary';
      case 'stopped':
        return 'text-muted-foreground';
      case 'error':
        return 'text-destructive';
    }
  };

  const getStatusLabel = (state: ContainerStatus['state']) => {
    switch (state) {
      case 'running':
        return 'Running';
      case 'created':
        return 'Created';
      case 'stopped':
        return 'Stopped';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Activity className={cn('w-4 h-4', getStatusColor(status.state))} />
        <h3 className="font-semibold text-sm">Sandbox Container</h3>
        <span className={cn('text-xs px-2 py-0.5 rounded', getStatusColor(status.state), 'bg-current/10')}>
          {getStatusLabel(status.state)}
        </span>
      </div>

      {status.state === 'running' && (
        <div className="space-y-2">
          {/* Uptime */}
          {status.uptime !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Uptime:</span>
              <span className="font-mono">{formatUptime(status.uptime)}</span>
            </div>
          )}

          {/* Resource Usage */}
          {status.resourceUsage && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Cpu className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">CPU:</span>
                <span className="font-mono">{status.resourceUsage.cpu.toFixed(1)}%</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${status.resourceUsage.cpu}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Memory:</span>
                <span className="font-mono">{status.resourceUsage.memory.toFixed(1)}%</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success transition-all"
                    style={{ width: `${status.resourceUsage.memory}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Disk:</span>
                <span className="font-mono">{status.resourceUsage.disk.toFixed(1)}%</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warning transition-all"
                    style={{ width: `${status.resourceUsage.disk}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mounted Directories */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Mounted Directories
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">/project</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">Read-only</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">/scratch</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">Read-write</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">/skills</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">Read-only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
