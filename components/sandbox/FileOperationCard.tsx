'use client';

import { useState } from 'react';
import { FileText, Edit, Download, ChevronDown, ChevronRight, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileOperationCardProps {
  operation: 'read' | 'write';
  path: string;
  content?: string;
  size?: number;
  linesRead?: { start: number; end: number; total: number };
}

export function FileOperationCard({
  operation,
  path,
  content = '',
  size,
  linesRead
}: FileOperationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isRead = operation === 'read';
  const Icon = isRead ? FileText : Edit;
  const hasContent = content.length > 0;

  // Truncate content for preview
  const previewLines = 5;
  const contentLines = content.split('\n');
  const preview = contentLines.slice(0, previewLines).join('\n');
  const isTruncated = contentLines.length > previewLines;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadContent = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 bg-muted/30">
        <Icon
          className={cn(
            'w-4 h-4 flex-shrink-0 mt-0.5',
            isRead ? 'text-primary' : 'text-success'
          )}
        />

        {/* Path */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {isRead ? 'Read File' : 'Wrote File'}
            </span>
            {hasContent && (
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
            {path}
          </code>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Size */}
          {size !== undefined && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="w-3 h-3" />
              {formatSize(size)}
            </span>
          )}

          {/* Lines Read */}
          {linesRead && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Lines {linesRead.start}-{linesRead.end} of {linesRead.total}
            </span>
          )}

          {/* Download Button */}
          {hasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadContent}
              className="h-6 w-6 p-0"
            >
              <Download className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Preview */}
      {hasContent && (
        <div className="border-t border-border">
          <div className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {expanded ? 'Content' : 'Preview'}
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {expanded ? content : preview}
            </pre>

            {isTruncated && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-primary hover:underline mt-2"
              >
                Show full content ({contentLines.length} lines)
              </button>
            )}
          </div>
        </div>
      )}

      {/* No Content Message */}
      {!hasContent && (
        <div className="p-3 border-t border-border text-center text-xs text-muted-foreground">
          {isRead ? 'File read successfully' : 'File written successfully'}
        </div>
      )}
    </div>
  );
}
