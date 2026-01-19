'use client';

import { useState } from 'react';
import { ToolCall } from '@/lib/types/chat';
import { ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getToolDisplayName, getToolIcon } from '@/lib/utils/toolDisplayNames';
import { cn } from '@/lib/utils';
import {
  motion,
  AnimatePresence,
  RotatingChevron,
  springs,
  FadeSlide,
} from '@/components/ui/motion';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const ToolIcon = getToolIcon(toolCall.name);
  const displayName = getToolDisplayName(toolCall.name);
  const isRunning = toolCall.status === 'running';
  const isFailed = toolCall.status === 'failed';
  const isCompleted = toolCall.status === 'completed';

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
        whileTap={{ scale: 0.995 }}
        transition={springs.snappy}
      >
        {/* Rotating Chevron */}
        <RotatingChevron isOpen={isExpanded}>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </RotatingChevron>

        {/* Tool Icon */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
          "bg-muted border border-border/50",
          isRunning && "bg-primary/10 border-primary/30",
          isFailed && "bg-destructive/10 border-destructive/30"
        )}>
          <ToolIcon className={cn(
            "w-4 h-4",
            isRunning ? "text-primary" : isFailed ? "text-destructive" : "text-foreground"
          )} />
        </div>

        {/* Tool Name */}
        <div className="flex-1 text-left">
          <div className={cn(
            "font-medium text-sm",
            isRunning && "text-primary",
            isFailed && "text-destructive",
            !isRunning && !isFailed && "text-foreground"
          )}>
            {displayName}
          </div>
          {toolCall.duration && (
            <div className="text-xs text-muted-foreground font-mono">
              {toolCall.duration}ms
            </div>
          )}
        </div>

        {/* Status Icon with animation */}
        <div className="flex-shrink-0">
          {isRunning && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
          {isCompleted && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springs.bouncy}
            >
              <CheckCircle2 className="w-4 h-4 text-success" />
            </motion.div>
          )}
          {isFailed && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springs.bouncy}
            >
              <XCircle className="w-4 h-4 text-destructive" />
            </motion.div>
          )}
        </div>
      </motion.button>

      {/* Expanded Content with AnimatePresence */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.smooth}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-border p-3 space-y-3 bg-muted/10">
              {/* Input */}
              <FadeSlide direction="up" className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Input
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto border border-border/50">
                  <pre className="whitespace-pre-wrap break-words text-foreground">
                    {JSON.stringify(toolCall.input, null, 2)}
                  </pre>
                </div>
              </FadeSlide>

              {/* Output */}
              {toolCall.output && (
                <FadeSlide direction="up" className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Output
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto border border-border/50">
                    <pre className="whitespace-pre-wrap break-words text-foreground">
                      {typeof toolCall.output === 'string'
                        ? toolCall.output
                        : JSON.stringify(toolCall.output, null, 2)}
                    </pre>
                  </div>
                </FadeSlide>
              )}

              {/* Error */}
              {toolCall.error && (
                <FadeSlide direction="up" className="space-y-1.5">
                  <div className="text-xs font-medium text-destructive uppercase tracking-wide">
                    Error
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 text-xs text-destructive">
                    {toolCall.error}
                  </div>
                </FadeSlide>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
