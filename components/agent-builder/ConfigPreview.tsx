'use client';

import { AgentConfig } from '@/lib/types/agent';
import { Button } from '@/components/ui/button';
import { Edit, Check, Bot, Code, Search, BarChart, FileText, Terminal, Folder, BookOpen } from 'lucide-react';
import { useMcpStore } from '@/lib/stores/mcpStore';

interface ConfigPreviewProps {
  config: Partial<AgentConfig>;
  onEdit: () => void;
  onApprove: () => void;
}

export function ConfigPreview({ config, onEdit, onApprove }: ConfigPreviewProps) {
  const { getConnection } = useMcpStore();

  // Extract purpose from system prompt (first paragraph)
  const extractPurpose = (systemPrompt: string) => {
    const lines = systemPrompt.split('\n').filter(l => l.trim());
    return lines[0] || 'No description available';
  };

  // Get icon component
  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      Bot,
      Code,
      Search,
      BarChart,
      FileText,
      Terminal,
      Database: BarChart, // Fallback
      Shield: Code, // Fallback
    };
    return icons[iconName] || Bot;
  };

  const IconComponent = getIconComponent(config.ui?.icon || 'Bot');

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.ui?.color || '#10b981', opacity: 0.15 }}
          >
            <IconComponent
              className="w-6 h-6"
              style={{ color: config.ui?.color || '#10b981' }}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{config.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Purpose */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Purpose
          </h3>
          <p className="text-sm text-muted-foreground">
            {extractPurpose(config.systemPrompt || '')}
          </p>
        </div>

        {/* Capabilities */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            Capabilities
          </h3>

          <div className="space-y-3">
            {/* Tools */}
            {config.tools && config.tools.enabled.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Tools</div>
                <div className="flex flex-wrap gap-2">
                  {config.tools.enabled.map((tool) => (
                    <span
                      key={tool}
                      className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {config.skills && config.skills.enabled.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Skills</div>
                <div className="flex flex-wrap gap-2">
                  {config.skills.enabled.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs px-2 py-1 rounded bg-muted/50 text-foreground border border-border"
                    >
                      {skill.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* MCP Connections */}
            {config.mcpConnections && config.mcpConnections.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Integrations</div>
                <div className="flex flex-wrap gap-2">
                  {config.mcpConnections.map((id) => {
                    const connection = getConnection(id);
                    return connection ? (
                      <span
                        key={id}
                        className="text-xs px-2 py-1 rounded bg-muted/50 text-foreground border border-border"
                      >
                        {connection.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Model */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Model</div>
              <span className="text-xs px-2 py-1 rounded bg-muted/50 text-foreground border border-border">
                Claude {config.model === 'sonnet' ? '3.5 Sonnet' : config.model === 'opus' ? '3 Opus' : '3 Haiku'}
              </span>
            </div>
          </div>
        </div>

        {/* Filesystem Usage */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Folder className="w-4 h-4 text-primary" />
            Filesystem Usage
          </h3>

          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Terminal className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-medium">/project (read-only)</div>
                <div className="text-xs text-muted-foreground">Your codebase and files</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Edit className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-medium">/scratch (read-write)</div>
                <div className="text-xs text-muted-foreground">Temporary workspace for results and analysis</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-medium">/skills (read-only)</div>
                <div className="text-xs text-muted-foreground">Pre-built knowledge and workflows</div>
              </div>
            </div>
          </div>
        </div>

        {/* Example Usage */}
        {config.tools && config.tools.enabled.includes('Read') && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Example Usage
            </h3>

            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="text-xs font-mono space-y-1 text-muted-foreground">
                <div>1. Read(&quot;/project/README.md&quot;) → Explore your files</div>
                <div>2. Bash(&quot;find /project -name &apos;*.ts&apos;&quot;) → Analyze structure</div>
                <div>3. Write(&quot;/scratch/report.md&quot;, &quot;...&quot;) → Save findings</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Handling */}
        {config.errorHandling?.retryOnFailure && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <div className="text-xs font-medium mb-1">Error Handling Enabled</div>
            <div className="text-xs text-muted-foreground">
              Automatic retry on failure (max {config.errorHandling.maxRetries || 3} retries)
              {config.errorHandling.fallbackModel && (
                <>, fallback to {config.errorHandling.fallbackModel}</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
        <Button variant="outline" onClick={onEdit}>
          <Edit className="w-3 h-3 mr-2" />
          Edit Details
        </Button>
        <Button onClick={onApprove}>
          <Check className="w-3 h-3 mr-2" />
          Create Agent
        </Button>
      </div>
    </div>
  );
}
