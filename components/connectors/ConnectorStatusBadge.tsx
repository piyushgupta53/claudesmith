'use client';

import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/lib/types/connector';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

interface ConnectorStatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<ConnectionStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  connected: {
    label: 'Connected',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  disconnected: {
    label: 'Disconnected',
    icon: XCircle,
    className: 'bg-muted text-muted-foreground border-border',
  },
  expired: {
    label: 'Expired',
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
};

export function ConnectorStatusBadge({
  status,
  className,
  showLabel = true,
}: ConnectorStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

/**
 * Compact status indicator (just the dot/icon)
 */
export function ConnectorStatusDot({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const colorMap: Record<ConnectionStatus, string> = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-muted-foreground',
    expired: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={cn(
        'w-2 h-2 rounded-full',
        colorMap[status],
        className
      )}
      title={STATUS_CONFIG[status].label}
    />
  );
}
