'use client';

import { useState } from 'react';
import type { ToolActivity } from '@/hooks/useStreamingMessages';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Clock,
  AlertTriangle,
  Activity,
  Zap,
} from 'lucide-react';
import { getToolDisplayName, getToolIcon, formatToolDuration, getBashCommandDescription } from '@/lib/utils/toolDisplayNames';
import { cn } from '@/lib/utils';
import {
  motion,
  AnimatePresence,
  RotatingChevron,
  springs,
  FadeSlide,
  StatusPulse,
} from '@/components/ui/motion';

interface ActivityFeedProps {
  activities: ToolActivity[];
  isStreaming: boolean;
}

function getToolDescription(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'WebSearch':
      return `"${input?.query || '...'}"`;
    case 'WebFetch':
      const url = input?.url as string;
      if (url) {
        try {
          return new URL(url).hostname;
        } catch {
          return 'webpage';
        }
      }
      return 'webpage';
    case 'Read':
      const readPath = input?.file_path as string;
      return readPath?.split('/').pop() || 'file';
    case 'Write':
      const writePath = input?.file_path as string;
      return writePath?.split('/').pop() || 'file';
    case 'Edit':
      const editPath = input?.file_path as string;
      return editPath?.split('/').pop() || 'file';
    case 'Bash':
      const cmd = input?.command as string;
      return cmd ? getBashCommandDescription(cmd) : 'command';
    case 'Grep':
      return `"${input?.pattern || '...'}"`;
    case 'Glob':
      return input?.pattern as string || 'pattern';
    default:
      return '';
  }
}

// Map ToolActivity status to StatusPulse status
function mapStatus(status: ToolActivity['status']): 'running' | 'completed' | 'failed' | 'pending' {
  if (status === 'slow') return 'running';
  return status;
}

function ActivityItem({ activity }: { activity: ToolActivity }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getToolIcon(activity.name);
  const displayName = getToolDisplayName(activity.name);
  const description = getToolDescription(activity.name, activity.input);

  const isRunning = activity.status === 'running';
  const isFailed = activity.status === 'failed';
  const isSlow = activity.status === 'slow';

  return (
    <div className="group relative">
      {/* Vertical timeline connector */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />

      {/* Activity card */}
      <div className={cn(
        "relative ml-6 rounded-lg transition-colors duration-200",
        "hover:bg-accent/30",
        isExpanded && "bg-accent/20"
      )}>
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 text-left px-3 py-2.5"
          whileTap={{ scale: 0.995 }}
          transition={springs.snappy}
        >
          {/* Status indicator positioned on timeline */}
          <div className="absolute left-[-17px] top-1/2 -translate-y-1/2">
            <StatusPulse status={mapStatus(activity.status)} />
          </div>

          {/* Rotating chevron */}
          <RotatingChevron
            isOpen={isExpanded}
            className={cn(
              "w-4 h-4",
              "text-muted-foreground/60 group-hover:text-muted-foreground"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </RotatingChevron>

          {/* Tool icon with background */}
          <div className={cn(
            "flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
            "bg-muted/50 border border-border/50",
            isRunning && "bg-primary/10 border-primary/30",
            isFailed && "bg-destructive/10 border-destructive/30",
            isSlow && "bg-warning/10 border-warning/30"
          )}>
            <Icon className={cn(
              "w-3.5 h-3.5",
              isRunning ? "text-primary" :
              isFailed ? "text-destructive" :
              isSlow ? "text-warning" :
              "text-muted-foreground"
            )} />
          </div>

          {/* Tool name and description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-medium",
                isRunning && "text-primary",
                isFailed && "text-destructive",
                isSlow && "text-warning"
              )}>
                {displayName}
              </span>
              {isRunning && (
                <Loader2 className="w-3 h-3 text-primary animate-spin" />
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[140px]">
                {description}
              </p>
            )}
          </div>

          {/* Duration badge */}
          {activity.duration !== undefined && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springs.gentle}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono",
                "bg-muted/50 border border-border/50",
                isFailed && "bg-destructive/10 border-destructive/20 text-destructive",
                isSlow && "bg-warning/10 border-warning/20 text-warning"
              )}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{formatToolDuration(activity.duration)}</span>
            </motion.div>
          )}
        </motion.button>

        {/* Expanded details panel with AnimatePresence */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springs.smooth}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-3 pb-3 pt-1 space-y-3">
                {/* Input section */}
                <FadeSlide direction="up" className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <Zap className="w-3 h-3" />
                    Input
                  </div>
                  <div className="relative group/code">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                    <pre className="relative bg-background/50 border border-border/50 rounded-lg p-3 text-[11px] font-mono overflow-x-auto max-h-32 overflow-y-auto text-foreground/90">
                      {JSON.stringify(activity.input, null, 2)}
                    </pre>
                  </div>
                </FadeSlide>

                {/* Output preview section */}
                {activity.outputPreview && (
                  <FadeSlide direction="up" className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      <Activity className="w-3 h-3" />
                      Output Preview
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-success/5 to-transparent pointer-events-none" />
                      <pre className="relative bg-background/50 border border-border/50 rounded-lg p-3 text-[11px] font-mono overflow-x-auto max-h-24 overflow-y-auto text-foreground/90">
                        {activity.outputPreview}
                      </pre>
                    </div>
                  </FadeSlide>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stat badge component with entrance animation
function StatBadge({
  count,
  label,
  variant,
  icon: IconComponent,
  animate = false
}: {
  count: number;
  label: string;
  variant: 'primary' | 'success' | 'warning' | 'destructive';
  icon: React.ComponentType<{ className?: string }>;
  animate?: boolean;
}) {
  const variantClasses = {
    primary: "bg-primary/15 text-primary border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30"
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={springs.gentle}
      layout
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        variantClasses[variant]
      )}
    >
      <IconComponent className={cn("w-3 h-3", animate && "animate-spin")} />
      <motion.span
        key={count}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold"
      >
        {count}
      </motion.span>
      <span className="text-[10px] opacity-80">{label}</span>
    </motion.div>
  );
}

// Stagger variants for activity list
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springs.gentle,
  },
};

export function ActivityFeed({ activities, isStreaming }: ActivityFeedProps) {
  const runningCount = activities.filter(a => a.status === 'running').length;
  const slowCount = activities.filter(a => a.status === 'slow').length;
  const completedCount = activities.filter(a => a.status === 'completed').length;
  const failedCount = activities.filter(a => a.status === 'failed').length;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-background/95">
      {/* Header with stats */}
      <div className="relative p-4 border-b border-border/50">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-2 flex-wrap">
          <AnimatePresence mode="popLayout">
            {isStreaming && runningCount > 0 && (
              <StatBadge
                key="running"
                count={runningCount}
                label="running"
                variant="primary"
                icon={Loader2}
                animate
              />
            )}
            {completedCount > 0 && (
              <StatBadge
                key="completed"
                count={completedCount}
                label="done"
                variant="success"
                icon={CheckCircle2}
              />
            )}
            {slowCount > 0 && (
              <StatBadge
                key="slow"
                count={slowCount}
                label="slow"
                variant="warning"
                icon={AlertTriangle}
              />
            )}
            {failedCount > 0 && (
              <StatBadge
                key="failed"
                count={failedCount}
                label="failed"
                variant="destructive"
                icon={XCircle}
              />
            )}
          </AnimatePresence>
          {activities.length === 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground/60 italic"
            >
              Waiting for activity...
            </motion.span>
          )}
        </div>
      </div>

      {/* Activity timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {activities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.gentle}
            className="h-full flex flex-col items-center justify-center text-center py-12 px-4"
          >
            <div className="relative mb-4">
              <motion.div
                className="absolute inset-0 rounded-full bg-muted/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
              />
              <div className="relative w-12 h-12 rounded-full bg-muted/50 border border-border/50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-muted-foreground/50" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70 max-w-[200px]">
              Tool calls will appear here as the agent works
            </p>
          </motion.div>
        ) : (
          <motion.div
            className="relative pl-3 space-y-1"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  variants={itemVariants}
                  layout
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                >
                  <ActivityItem activity={activity} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
