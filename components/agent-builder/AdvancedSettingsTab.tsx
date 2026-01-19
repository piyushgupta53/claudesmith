'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentConfig, PermissionMode } from '@/lib/types/agent';

interface AdvancedSettingsTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  {
    value: 'default',
    label: 'Default',
    description: 'Ask for permission before executing sensitive operations'
  },
  {
    value: 'acceptEdits',
    label: 'Accept Edits',
    description: 'Auto-approve file operations and filesystem commands'
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass Permissions',
    description: 'Auto-approve all operations (use with caution)'
  },
  {
    value: 'dontAsk',
    label: "Don't Ask",
    description: 'Auto-deny unless explicitly allowed'
  },
  {
    value: 'plan',
    label: 'Plan Mode',
    description: 'Enter plan mode before execution'
  },
];

export function AdvancedSettingsTab({ config, onChange }: AdvancedSettingsTabProps) {
  const settings = config.settings || {
    maxTurns: 50,
    maxBudgetUsd: 1.0,
    permissionMode: 'default' as PermissionMode,
    enableFileCheckpointing: false,
  };

  const updateSettings = (updates: Partial<typeof settings>) => {
    onChange({
      settings: { ...settings, ...updates }
    });
  };

  return (
    <div className="space-y-6">
      {/* Max Turns */}
      <div className="space-y-2">
        <Label htmlFor="maxTurns">Maximum Turns</Label>
        <Input
          id="maxTurns"
          type="number"
          min="1"
          max="500"
          value={settings.maxTurns || 50}
          onChange={(e) => updateSettings({ maxTurns: parseInt(e.target.value) || 50 })}
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of agent turns before stopping (default: 50)
        </p>
      </div>

      {/* Max Budget */}
      <div className="space-y-2">
        <Label htmlFor="maxBudget">Maximum Budget (USD)</Label>
        <Input
          id="maxBudget"
          type="number"
          min="0"
          step="0.1"
          value={settings.maxBudgetUsd || 1.0}
          onChange={(e) => updateSettings({ maxBudgetUsd: parseFloat(e.target.value) || 1.0 })}
        />
        <p className="text-xs text-muted-foreground">
          Maximum cost in USD before stopping execution (default: $1.00)
        </p>
      </div>

      {/* Max Thinking Tokens */}
      <div className="space-y-2">
        <Label htmlFor="maxThinkingTokens">Maximum Thinking Tokens (Optional)</Label>
        <Input
          id="maxThinkingTokens"
          type="number"
          min="0"
          value={settings.maxThinkingTokens || ''}
          onChange={(e) => updateSettings({ maxThinkingTokens: parseInt(e.target.value) || undefined })}
          placeholder="No limit"
        />
        <p className="text-xs text-muted-foreground">
          Limit extended thinking tokens (leave empty for no limit)
        </p>
      </div>

      {/* Permission Mode */}
      <div className="space-y-2">
        <Label htmlFor="permissionMode">Permission Mode</Label>
        <Select
          value={settings.permissionMode}
          onValueChange={(value) => updateSettings({ permissionMode: value as PermissionMode })}
        >
          <SelectTrigger id="permissionMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERMISSION_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                <div>
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">{mode.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Control how the agent handles permission requests
        </p>
      </div>

      {/* File Checkpointing */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="fileCheckpointing"
            checked={settings.enableFileCheckpointing || false}
            onChange={(e) => updateSettings({ enableFileCheckpointing: e.target.checked })}
            className="w-4 h-4"
          />
          <Label htmlFor="fileCheckpointing" className="cursor-pointer">
            Enable File Checkpointing
          </Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Track file modifications and allow rewinding to previous states
        </p>
      </div>
    </div>
  );
}
