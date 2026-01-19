'use client';

import { useState } from 'react';
import { PermissionRequest } from '@/lib/types/execution';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getToolDisplayName, getToolIcon } from '@/lib/utils/toolDisplayNames';

interface PermissionDialogProps {
  request: PermissionRequest;
  onApprove: () => void;
  onDeny: () => void;
  isOpen: boolean;
}

export function PermissionDialog({
  request,
  onApprove,
  onDeny,
  isOpen,
}: PermissionDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const ToolIcon = getToolIcon(request.toolName);
  const displayName = getToolDisplayName(request.toolName);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove();
    setIsProcessing(false);
  };

  const handleDeny = async () => {
    setIsProcessing(true);
    await onDeny();
    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Permission Required
          </DialogTitle>
          <DialogDescription>
            The agent is requesting permission to execute a tool
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tool Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-background flex items-center justify-center">
              <ToolIcon className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-foreground">
                {displayName}
              </div>
              <div className="text-xs text-muted-foreground">
                Tool execution
              </div>
            </div>
          </div>

          {/* Tool Input */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Input Parameters
            </div>
            <div className="bg-muted/50 rounded-md p-3 overflow-x-auto max-h-48 overflow-y-auto border border-border/50">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
                {JSON.stringify(request.toolInput, null, 2)}
              </pre>
            </div>
          </div>

          {/* Suggestions (if available) */}
          {request.suggestions && request.suggestions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Suggestions
              </div>
              <ul className="space-y-1 text-sm">
                {request.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning */}
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground mb-1">
                Review carefully before approving
              </p>
              <p className="text-muted-foreground">
                Make sure you understand what this tool will do. Approving will allow the
                agent to execute this operation.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleDeny}
            disabled={isProcessing}
            className="gap-2"
          >
            <XCircle className="w-4 h-4" />
            Deny
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isProcessing}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
