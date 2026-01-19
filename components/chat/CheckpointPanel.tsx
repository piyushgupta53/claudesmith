'use client';

import { useState } from 'react';
import { useExecutionStore } from '@/lib/stores/executionStore';
import type { Checkpoint, RewindResult } from '@/lib/types/execution';
import {
  History,
  RotateCcw,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
  X,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CheckpointPanelProps {
  sessionId: string;
  isStreaming: boolean;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function CheckpointItem({
  checkpoint,
  onRewind,
  isRewinding,
  isDisabled,
  index,
}: {
  checkpoint: Checkpoint;
  onRewind: () => void;
  isRewinding: boolean;
  isDisabled: boolean;
  index: number;
}) {
  const canRewind = checkpoint.canRewind && !isDisabled;

  return (
    <div
      className="group relative animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      {/* Vertical timeline connector */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />

      {/* Checkpoint card */}
      <div className={cn(
        "relative ml-6 rounded-lg transition-all duration-200",
        "hover:bg-accent/30",
        isRewinding && "bg-primary/5"
      )}>
        {/* Timeline dot */}
        <div className="absolute left-[-17px] top-4">
          <div className={cn(
            "w-2 h-2 rounded-full transition-all duration-200",
            isRewinding
              ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
              : canRewind
                ? "bg-muted-foreground/50 group-hover:bg-primary group-hover:shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
                : "bg-muted-foreground/30"
          )} />
        </div>

        <div className="px-3 py-3">
          <div className="flex items-start gap-3">
            {/* Icon with background */}
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
              "bg-muted/50 border border-border/50",
              isRewinding && "bg-primary/10 border-primary/30",
              canRewind && "group-hover:bg-primary/10 group-hover:border-primary/30"
            )}>
              {isRewinding ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <FileText className={cn(
                  "w-4 h-4 transition-colors",
                  canRewind ? "text-muted-foreground group-hover:text-primary" : "text-muted-foreground/50"
                )} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Timestamp badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono",
                  "bg-muted/50 border border-border/50 text-muted-foreground"
                )}>
                  <Clock className="w-2.5 h-2.5" />
                  {formatTimestamp(checkpoint.timestamp)}
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                  {formatRelativeTime(checkpoint.timestamp)}
                </span>
              </div>

              {/* Preview text */}
              <p className={cn(
                "text-sm leading-snug transition-colors",
                canRewind ? "text-foreground/80 group-hover:text-foreground" : "text-foreground/50"
              )} title={checkpoint.preview}>
                {checkpoint.preview || 'User message'}
              </p>
            </div>

            {/* Rewind button */}
            <div className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRewind}
                disabled={!canRewind || isRewinding}
                className={cn(
                  "h-8 px-2.5 rounded-lg text-xs transition-all duration-200",
                  "border border-transparent",
                  canRewind && !isRewinding && "hover:bg-primary/10 hover:border-primary/30 hover:text-primary",
                  isRewinding && "bg-primary/10 border-primary/30 text-primary"
                )}
                title={!checkpoint.canRewind ? 'Cannot rewind to this checkpoint' : 'Rewind files to this state'}
              >
                {isRewinding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span className="ml-1.5 hidden sm:inline">Rewind</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast notification component
function ResultToast({
  result,
  onDismiss
}: {
  result: RewindResult;
  onDismiss: () => void;
}) {
  const isSuccess = result.canRewind;

  return (
    <div className={cn(
      "mx-4 mt-4 rounded-lg overflow-hidden animate-scale-in",
      "border shadow-lg",
      isSuccess
        ? "bg-success/10 border-success/30"
        : "bg-destructive/10 border-destructive/30"
    )}>
      {/* Gradient accent bar */}
      <div className={cn(
        "h-0.5",
        isSuccess
          ? "bg-gradient-to-r from-success/50 via-success to-success/50"
          : "bg-gradient-to-r from-destructive/50 via-destructive to-destructive/50"
      )} />

      <div className="p-3 flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
          isSuccess
            ? "bg-success/20 border border-success/30"
            : "bg-destructive/20 border border-destructive/30"
        )}>
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <AlertCircle className="w-4 h-4 text-destructive" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium",
            isSuccess ? "text-success" : "text-destructive"
          )}>
            {isSuccess ? 'Files rewound successfully' : 'Rewind failed'}
          </p>
          {isSuccess && result.filesChanged && result.filesChanged.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.filesChanged.length} file(s) changed
              {result.insertions !== undefined && (
                <span className="text-success ml-1">(+{result.insertions})</span>
              )}
              {result.deletions !== undefined && (
                <span className="text-destructive ml-1">(-{result.deletions})</span>
              )}
            </p>
          ) : !isSuccess && result.error ? (
            <p className="text-xs text-muted-foreground mt-0.5">{result.error}</p>
          ) : null}
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors",
            "text-muted-foreground/60 hover:text-foreground",
            isSuccess ? "hover:bg-success/20" : "hover:bg-destructive/20"
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CheckpointPanel({ sessionId, isStreaming }: CheckpointPanelProps) {
  const getCheckpoints = useExecutionStore(state => state.getCheckpoints);
  const checkpoints = getCheckpoints(sessionId) ?? [];
  const [rewindingId, setRewindingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RewindResult | null>(null);

  const handleRewind = async (checkpoint: Checkpoint) => {
    setRewindingId(checkpoint.id);
    setLastResult(null);

    try {
      const response = await fetch(`/api/chat/${sessionId}/checkpoint/rewind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageUuid: checkpoint.messageUuid }),
      });

      const result: RewindResult = await response.json();
      setLastResult(result);

      if (result.canRewind) {
        console.log(`[Checkpoint] Rewound successfully: ${result.filesChanged?.length || 0} files`);
      } else {
        console.error(`[Checkpoint] Rewind failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('[Checkpoint] Rewind error:', error);
      setLastResult({
        canRewind: false,
        error: error.message || 'Failed to rewind files',
      });
    } finally {
      setRewindingId(null);
    }
  };

  // Sort checkpoints by timestamp (newest first for display)
  const sortedCheckpoints = [...checkpoints].reverse();

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-background/95">
      {/* Header */}
      <div className="relative p-4 border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">File Checkpoints</h3>
            {checkpoints.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                {checkpoints.length} {checkpoints.length === 1 ? 'checkpoint' : 'checkpoints'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Result toast */}
      {lastResult && (
        <ResultToast result={lastResult} onDismiss={() => setLastResult(null)} />
      )}

      {/* Checkpoint list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {sortedCheckpoints.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-xl bg-muted/20 animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="relative w-14 h-14 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center">
                <History className="w-6 h-6 text-muted-foreground/40" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70 font-medium mb-1.5">
              No checkpoints yet
            </p>
            <p className="text-xs text-muted-foreground/50 max-w-[200px] leading-relaxed">
              Checkpoints are created at each user message when file checkpointing is enabled
            </p>
          </div>
        ) : (
          <div className="relative pl-3">
            {sortedCheckpoints.map((checkpoint, index) => (
              <CheckpointItem
                key={checkpoint.id}
                checkpoint={checkpoint}
                onRewind={() => handleRewind(checkpoint)}
                isRewinding={rewindingId === checkpoint.id}
                isDisabled={isStreaming || rewindingId !== null}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {sortedCheckpoints.length > 0 && (
        <div className="relative p-4 border-t border-border/50">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 pointer-events-none" />
          <div className="relative flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary/60 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Rewinding restores files to their state at the selected checkpoint
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
