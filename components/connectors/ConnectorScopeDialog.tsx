'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { OAuthProvider, OAuthProviderConfig, OAuthScope } from '@/lib/types/connector';
import { getProviderConfig } from '@/lib/connectors/providers';
import { Mail, MessageSquare, FileText, Github, ExternalLink, Shield } from 'lucide-react';

interface ConnectorScopeDialogProps {
  open: boolean;
  onClose: () => void;
  provider: OAuthProvider | null;
  onConfirm: (scopes: string[]) => void;
  isLoading?: boolean;
}

// Map provider icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Mail: Mail,
  MessageSquare: MessageSquare,
  FileText: FileText,
  Github: Github,
};

export function ConnectorScopeDialog({
  open,
  onClose,
  provider,
  onConfirm,
  isLoading,
}: ConnectorScopeDialogProps) {
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());

  // Get provider config
  const config = provider ? getProviderConfig(provider) : null;
  const Icon = config ? (ICON_MAP[config.icon] || FileText) : FileText;

  // Initialize selected scopes when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && config) {
      // Select default scopes
      setSelectedScopes(new Set(config.defaultScopes));
    } else if (!isOpen) {
      onClose();
    }
  };

  const handleScopeToggle = (scope: string, checked: boolean) => {
    const newScopes = new Set(selectedScopes);
    if (checked) {
      newScopes.add(scope);
    } else {
      newScopes.delete(scope);
    }
    setSelectedScopes(newScopes);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedScopes));
  };

  if (!config) return null;

  const requiredScopes = config.scopes.filter((s) => s.required);
  const optionalScopes = config.scopes.filter((s) => !s.required);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Icon className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div>
              <DialogTitle>Connect to {config.name}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Security note */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Shield className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-xs text-muted-foreground">
              You&apos;ll be redirected to {config.name} to grant access. Your
              credentials are never stored on our servers.
            </p>
          </div>

          {/* Required scopes */}
          {requiredScopes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Required Permissions</h4>
              {requiredScopes.map((scope) => (
                <ScopeItem
                  key={scope.value}
                  scope={scope}
                  checked={selectedScopes.has(scope.value)}
                  onCheckedChange={(checked) =>
                    handleScopeToggle(scope.value, checked)
                  }
                  disabled={true}
                />
              ))}
            </div>
          )}

          {/* Optional scopes */}
          {optionalScopes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Optional Permissions</h4>
              {optionalScopes.map((scope) => (
                <ScopeItem
                  key={scope.value}
                  scope={scope}
                  checked={selectedScopes.has(scope.value)}
                  onCheckedChange={(checked) =>
                    handleScopeToggle(scope.value, checked)
                  }
                  disabled={false}
                />
              ))}
            </div>
          )}

          {/* Tools that will be available */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tools You&apos;ll Get</h4>
            <div className="flex flex-wrap gap-2">
              {config.tools
                .filter((tool) =>
                  tool.requiredScopes.every((s) => selectedScopes.has(s)) ||
                  tool.requiredScopes.length === 0
                )
                .map((tool) => (
                  <span
                    key={tool.name}
                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono"
                  >
                    {tool.name}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              'Connecting...'
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Continue to {config.name}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ScopeItemProps {
  scope: OAuthScope;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}

function ScopeItem({ scope, checked, onCheckedChange, disabled }: ScopeItemProps) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={scope.value}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-1"
      />
      <div className="flex-1">
        <Label
          htmlFor={scope.value}
          className="text-sm font-medium cursor-pointer"
        >
          {scope.name}
          {scope.required && (
            <span className="text-xs text-muted-foreground ml-1">(required)</span>
          )}
        </Label>
        <p className="text-xs text-muted-foreground">{scope.description}</p>
      </div>
    </div>
  );
}
