'use client';

import { useState, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentConfig, HookEvent } from '@/lib/types/agent';
import { Zap, Plus, Trash2, Info, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HooksTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

// Hook presets for common use cases (SDK-compliant signatures)
const HOOK_PRESETS: Record<string, { label: string; event: HookEvent; code: string; matcher?: string; category?: 'logging' | 'safety' | 'utility' }> = {
  // === LOGGING PRESETS ===
  logTools: {
    label: 'Log All Tool Uses',
    event: 'PostToolUse',
    category: 'logging',
    code: `// Log tool execution details
console.log(\`Tool: \${input.tool_name}\`);
console.log(\`Input: \${JSON.stringify(input.tool_input)}\`);
console.log(\`Output: \${JSON.stringify(input.tool_response)}\`);

// Return success (continue execution)
return {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: \`Logged execution of \${input.tool_name}\`
  }
};`
  },
  saveBashOutput: {
    label: 'Save Bash Output',
    event: 'PostToolUse',
    matcher: 'Bash',
    category: 'logging',
    code: `// Save Bash command output to log file
if (input.tool_name === "Bash") {
  const timestamp = new Date().toISOString();
  const command = input.tool_input?.command || 'unknown';
  const output = input.tool_response?.output || '';

  const logEntry = \`[\${timestamp}] \${command}\\n\${output}\\n---\\n\\n\`;

  console.log(\`Logged Bash output to /scratch/bash-log.txt\`);

  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: \`Bash command logged: \${command}\`
    }
  };
}

return {};`
  },

  // === SAFETY PRESETS ===
  blockDangerousBash: {
    label: 'Block Dangerous Bash Commands',
    event: 'PreToolUse',
    matcher: 'Bash',
    category: 'safety',
    code: `// Block dangerous bash commands
const command = (input.tool_input?.command || '').toLowerCase();

const dangerousPatterns = [
  'rm -rf /',
  'rm -rf ~',
  'rm -rf *',
  'rm -rf .',
  'sudo rm',
  'mkfs.',
  'dd if=',
  '> /dev/',
  'chmod 777',
  'chmod -R 777',
  ':(){:|:&};:',  // Fork bomb
  'wget | sh',
  'curl | sh',
  'curl | bash',
  '| sh',
  '| bash',
];

for (const pattern of dangerousPatterns) {
  if (command.includes(pattern)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: \`Blocked dangerous command pattern: \${pattern}\`
      }
    };
  }
}

// Allow safe commands
return {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow'
  }
};`
  },
  restrictFilePaths: {
    label: 'Restrict File Paths to /project and /scratch',
    event: 'PreToolUse',
    category: 'safety',
    code: `// Restrict file operations to allowed directories
const fileTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'NotebookEdit'];

if (!fileTools.includes(input.tool_name)) {
  return {}; // Not a file tool, allow
}

const filePath = input.tool_input?.file_path ||
                 input.tool_input?.path ||
                 input.tool_input?.notebook_path || '';

const allowedPrefixes = ['/project', '/scratch', '/skills'];

const isAllowed = allowedPrefixes.some(prefix => filePath.startsWith(prefix));

if (!isAllowed && filePath) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: \`File access denied: \${filePath} is outside allowed directories (/project, /scratch)\`
    }
  };
}

return {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow'
  }
};`
  },
  blockSecretAccess: {
    label: 'Block Access to Secret Files',
    event: 'PreToolUse',
    category: 'safety',
    code: `// Block access to sensitive files
const filePath = (input.tool_input?.file_path ||
                  input.tool_input?.path ||
                  input.tool_input?.command || '').toLowerCase();

const secretPatterns = [
  '.env',
  '.env.local',
  '.env.production',
  'credentials',
  'secrets',
  'private_key',
  'id_rsa',
  'id_ed25519',
  '.pem',
  '.key',
  'password',
  'api_key',
  'apikey',
  'auth_token',
  '.aws/credentials',
  '.ssh/',
  '.gnupg/',
];

for (const pattern of secretPatterns) {
  if (filePath.includes(pattern)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: \`Blocked access to sensitive file: matches pattern "\${pattern}"\`
      }
    };
  }
}

return {};`
  },
  confirmWrites: {
    label: 'Require Confirmation for Write Operations',
    event: 'PreToolUse',
    category: 'safety',
    code: `// Require confirmation for write operations
const writeTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

if (writeTools.includes(input.tool_name)) {
  const filePath = input.tool_input?.file_path || input.tool_input?.path || 'unknown';

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: \`Write operation to: \${filePath}\`
    }
  };
}

return {};`
  },
  blockNetworkInBash: {
    label: 'Block Network Commands in Bash',
    event: 'PreToolUse',
    matcher: 'Bash',
    category: 'safety',
    code: `// Block network commands in bash (for isolated sandbox)
const command = (input.tool_input?.command || '').toLowerCase();

const networkCommands = [
  'curl ',
  'wget ',
  'nc ',
  'netcat ',
  'ssh ',
  'scp ',
  'rsync ',
  'ftp ',
  'telnet ',
  'nmap ',
  'ping ',
  'traceroute ',
  'dig ',
  'nslookup ',
  'host ',
];

for (const netCmd of networkCommands) {
  if (command.includes(netCmd)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: \`Network command blocked in sandbox: \${netCmd.trim()}\`
      }
    };
  }
}

return {};`
  },

  // === UTILITY PRESETS ===
  rateLimit: {
    label: 'Rate Limit Tools',
    event: 'PreToolUse',
    category: 'utility',
    code: `// Rate limit tool calls (1 per second)
const lastCall = globalThis.hookRateLimitState || {};
const now = Date.now();

if (lastCall[input.tool_name] && now - lastCall[input.tool_name] < 1000) {
  // Deny - rate limit exceeded
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Rate limit: Wait 1 second between calls'
    }
  };
}

// Update last call time
lastCall[input.tool_name] = now;
globalThis.hookRateLimitState = lastCall;

// Allow - within rate limit
return {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow'
  }
};`
  },
  budgetTracker: {
    label: 'Track Budget (SessionEnd)',
    event: 'SessionEnd',
    category: 'utility',
    code: `// Track total session cost
const totalCost = globalThis.hookTotalCost || 0;
console.log(\`Session ended. Total cost: $\${totalCost.toFixed(4)}\`);

if (totalCost > 1.0) {
  console.warn(\`Budget exceeded: $\${totalCost.toFixed(4)} / $1.00\`);
  return {
    systemMessage: \`Budget warning: Session cost $\${totalCost.toFixed(4)} exceeded $1.00 limit\`
  };
}

return {
  systemMessage: \`Session completed. Total cost: $\${totalCost.toFixed(4)}\`
};`
  },
  autoApproveRead: {
    label: 'Auto-Approve Read Operations',
    event: 'PreToolUse',
    matcher: 'Read',
    category: 'utility',
    code: `// Auto-approve read-only operations
const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];

if (readOnlyTools.includes(input.tool_name)) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Auto-approved: read-only operation'
    }
  };
}

// For non-read tools, defer to default permission handling
return {};`
  }
};

// Hook event descriptions (aligned with Claude Agent SDK)
const HOOK_EVENT_INFO: Record<HookEvent, string> = {
  PreToolUse: 'Runs before each tool is executed. Can modify input, control permissions, or block execution.',
  PostToolUse: 'Runs after each tool completes successfully. Can inspect output and perform logging.',
  PostToolUseFailure: 'Runs when a tool execution fails. Can implement custom error handling and recovery.',
  Notification: 'Runs when Claude sends a notification to the user.',
  UserPromptSubmit: 'Runs when the user submits a prompt. Can add additional context.',
  SessionStart: 'Runs once when the agent session starts. Can perform initialization.',
  SessionEnd: 'Runs once when the agent session ends. Can perform cleanup and final reporting.',
  Stop: 'Runs when execution is stopped by the user or system.',
  SubagentStart: 'Runs before a subagent is invoked. Can modify the subagent configuration.',
  SubagentStop: 'Runs after a subagent completes. Can inspect subagent results.',
  PreCompact: 'Runs before conversation context is compacted to save tokens.',
  PermissionRequest: 'Runs when a tool requests permission. Can auto-approve or add context.'
};

interface Hook {
  event: HookEvent;
  matcher?: string;
  code: string;
}

export function HooksTab({ config, onChange }: HooksTabProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [editingHook, setEditingHook] = useState<{ event: HookEvent; index: number } | null>(null);
  const [hookCode, setHookCode] = useState('');
  const [hookMatcher, setHookMatcher] = useState('');

  // PERFORMANCE: Memoize hooks to stabilize dependency arrays
  const hooks = useMemo(() => config.hooks || {}, [config.hooks]);

  // PERFORMANCE: Memoize filtered preset categories to avoid recalculation on every render
  const safetyPresets = useMemo(() =>
    Object.entries(HOOK_PRESETS).filter(([, preset]) => preset.category === 'safety'),
    []
  );
  const loggingPresets = useMemo(() =>
    Object.entries(HOOK_PRESETS).filter(([, preset]) => preset.category === 'logging'),
    []
  );
  const utilityPresets = useMemo(() =>
    Object.entries(HOOK_PRESETS).filter(([, preset]) => preset.category === 'utility'),
    []
  );

  const addHook = useCallback((event: HookEvent) => {
    setEditingHook({ event, index: -1 }); // -1 means new hook
    setHookCode('');
    setHookMatcher('');
  }, []);

  const editHook = useCallback((event: HookEvent, index: number) => {
    const hook = hooks[event]?.[index];
    if (hook) {
      setEditingHook({ event, index });
      setHookCode(hook.code);
      setHookMatcher(hook.matcher || '');
    }
  }, [hooks]);

  const saveHook = useCallback(() => {
    if (!editingHook || !hookCode.trim()) return;

    const { event, index } = editingHook;
    const currentHooks = hooks[event] || [];
    const newHook: Hook = {
      event,
      matcher: hookMatcher.trim() || undefined,
      code: hookCode.trim()
    };

    let updatedHooks;
    if (index === -1) {
      // New hook
      updatedHooks = [...currentHooks, newHook];
    } else {
      // Update existing
      updatedHooks = [...currentHooks];
      updatedHooks[index] = newHook;
    }

    onChange({
      hooks: {
        ...hooks,
        [event]: updatedHooks
      }
    });

    setEditingHook(null);
    setHookCode('');
    setHookMatcher('');
  }, [editingHook, hookCode, hookMatcher, hooks, onChange]);

  const deleteHook = useCallback((event: HookEvent, index: number) => {
    const currentHooks = hooks[event] || [];
    const updatedHooks = currentHooks.filter((_, i) => i !== index);

    if (updatedHooks.length === 0) {
      const { [event]: _, ...remainingHooks } = hooks;
      onChange({ hooks: remainingHooks });
    } else {
      onChange({
        hooks: {
          ...hooks,
          [event]: updatedHooks
        }
      });
    }
  }, [hooks, onChange]);

  const loadPreset = useCallback((presetKey: string) => {
    const preset = HOOK_PRESETS[presetKey];
    if (preset) {
      setEditingHook({ event: preset.event, index: -1 });
      setHookCode(preset.code);
      setHookMatcher(preset.matcher || '');
      setShowPresets(false);
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingHook(null);
    setHookCode('');
    setHookMatcher('');
  }, []);

  const getHookCount = useCallback(() => {
    return Object.values(hooks).reduce((sum, eventHooks) => sum + eventHooks.length, 0);
  }, [hooks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>Event Hooks</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Execute custom JavaScript code at key points in your agent&apos;s lifecycle
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What are Hooks?
            </h4>
            <p className="text-xs text-muted-foreground">
              Hooks allow you to run custom code when specific events occur during agent execution.
              Use them for logging, rate limiting, budget tracking, auto-approvals, and more.
            </p>
          </div>
        </div>
      </div>

      {/* Hook Presets */}
      <div className="border border-border rounded-lg bg-card">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium text-sm">Hook Presets</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Choose from pre-written hooks for common use cases
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {showPresets ? 'Hide' : 'Show'}
          </div>
        </button>

        {showPresets && (
          <div className="border-t border-border p-4 space-y-4">
            {/* Safety Presets */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-destructive">Safety</span>
                <span className="text-xs text-muted-foreground">(Recommended)</span>
              </div>
              <div className="space-y-2">
                {safetyPresets.map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => loadPreset(key)}
                    className="w-full text-left p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{preset.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Event: {preset.event}
                          {preset.matcher && <> • Matcher: {preset.matcher}</>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Logging Presets */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Logging</div>
              <div className="space-y-2">
                {loggingPresets.map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => loadPreset(key)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{preset.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Event: {preset.event}
                          {preset.matcher && <> • Matcher: {preset.matcher}</>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Utility Presets */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utility</div>
              <div className="space-y-2">
                {utilityPresets.map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => loadPreset(key)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{preset.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Event: {preset.event}
                          {preset.matcher && <> • Matcher: {preset.matcher}</>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hook Editor Dialog */}
      {editingHook && (
        <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            {editingHook.index === -1 ? 'Add Hook' : 'Edit Hook'}
          </h3>

          <div className="space-y-3">
            {/* Matcher (optional) */}
            <div>
              <Label className="text-xs">Matcher (Optional)</Label>
              <Input
                value={hookMatcher}
                onChange={(e) => setHookMatcher(e.target.value)}
                placeholder="e.g., Bash, Read, or leave empty for all"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only fire this hook for a specific tool or subagent name
              </p>
            </div>

            {/* Code Editor */}
            <div>
              <Label className="text-xs">JavaScript Code</Label>
              <textarea
                value={hookCode}
                onChange={(e) => setHookCode(e.target.value)}
                placeholder={`async function hook(context) {\n  // Your code here\n  console.log(context);\n}`}
                className="w-full h-32 p-3 rounded-lg border border-border bg-background font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary mt-1"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Event: {editingHook.event} • {HOOK_EVENT_INFO[editingHook.event]}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={saveHook} size="sm" disabled={!hookCode.trim()}>
                {editingHook.index === -1 ? 'Add Hook' : 'Save Changes'}
              </Button>
              <Button onClick={cancelEdit} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hook Events List */}
      <div className="space-y-4">
        {(Object.keys(HOOK_EVENT_INFO) as HookEvent[]).map((event) => {
          const eventHooks = hooks[event] || [];

          return (
            <div key={event} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">{event}</h4>
                    {eventHooks.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {eventHooks.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {HOOK_EVENT_INFO[event]}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addHook(event)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              {/* Hooks for this event */}
              {eventHooks.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border">
                  {eventHooks.map((hook, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        {hook.matcher && (
                          <div className="text-xs font-medium mb-1">
                            Matcher: {hook.matcher}
                          </div>
                        )}
                        <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                          {hook.code.split('\n')[0]}...
                        </pre>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editHook(event, index)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHook(event, index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {getHookCount()} hook{getHookCount() !== 1 ? 's' : ''} configured
      </div>
    </div>
  );
}
