'use client';

import { useState } from 'react';
import { Terminal, Copy, Check, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BashExecutionCardProps {
  command: string;
  stdout?: string;
  stderr?: string;
  exitCode: number;
  executionTime?: number;
}

export function BashExecutionCard({
  command,
  stdout = '',
  stderr = '',
  exitCode,
  executionTime
}: BashExecutionCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isSuccess = exitCode === 0;
  const hasOutput = stdout.length > 0 || stderr.length > 0;

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple ANSI color conversion (basic implementation)
  const renderWithColors = (text: string) => {
    // For now, just return the text as-is
    // Full ANSI support would require a library like ansi-to-html
    return text;
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 bg-muted/30">
        <Terminal className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />

        {/* Command */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">Bash Command</span>
            {hasOutput && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
          <code className="block text-sm font-mono break-all">
            {command}
          </code>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Exit Code */}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded font-medium',
              isSuccess
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            )}
          >
            Exit {exitCode}
          </span>

          {/* Execution Time */}
          {executionTime !== undefined && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {executionTime}ms
            </span>
          )}

          {/* Copy Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCommand}
            className="h-6 w-6 p-0"
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Output */}
      {hasOutput && expanded && (
        <div className="border-t border-border">
          {/* Stdout */}
          {stdout && (
            <div className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Output (stdout)
              </div>
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                {renderWithColors(stdout)}
              </pre>
            </div>
          )}

          {/* Stderr */}
          {stderr && (
            <div className="p-3 border-t border-border">
              <div className="text-xs font-medium text-destructive mb-2">
                Errors (stderr)
              </div>
              <pre className="text-xs font-mono bg-destructive/5 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words text-destructive">
                {renderWithColors(stderr)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* No Output Message */}
      {!hasOutput && expanded && (
        <div className="p-3 border-t border-border text-center text-xs text-muted-foreground">
          No output
        </div>
      )}
    </div>
  );
}
