'use client';

import { useAgentStore } from '@/lib/stores/agentStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, MessageSquare, Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { exportAgentConfig } from '@/lib/utils/exportImport';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { getAgent, deleteAgent } = useAgentStore();
  const agent = getAgent(id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const handleExport = () => {
    if (agent) {
      exportAgentConfig(agent);
      toast({
        variant: 'success',
        title: 'Agent exported',
        description: `Configuration for "${agent.name}" has been downloaded.`,
      });
    }
  };

  const handleDelete = () => {
    if (agent) {
      deleteAgent(id);
      toast({
        variant: 'success',
        title: 'Agent deleted',
        description: `"${agent.name}" has been removed from your library.`,
      });
      router.push('/');
    }
  };

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Agent not found</p>
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="mt-4"
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <p className="text-muted-foreground mt-1">
                {agent.description}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              title="Export agent configuration"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/agents/${id}/edit`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete agent"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button onClick={() => {
              // Create a new session ID and navigate to chat
              const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              router.push(`/chat/${sessionId}?agentId=${id}`);
            }}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
          </div>
        </div>

        {/* Agent Details */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="border border-border rounded-lg p-6 bg-card shadow-sm">
            <h2 className="text-base font-semibold mb-4 text-foreground">Configuration</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Model</p>
                <p className="font-medium text-sm text-foreground">{agent.model}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                <p className="font-medium text-sm text-foreground">{agent.ui.category}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tools</p>
                <p className="font-medium text-sm text-foreground">{agent.tools.enabled.length} Enabled</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Subagents</p>
                <p className="font-medium text-sm text-foreground">{Object.keys(agent.subagents ?? {}).length} Attached</p>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div className="border border-border rounded-lg p-6 bg-card shadow-sm">
            <h2 className="text-base font-semibold mb-4 text-foreground">System Prompt</h2>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-secondary/50 p-4 rounded-md border border-border/50">
              {agent.systemPrompt}
            </pre>
          </div>

          {/* Tools */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4">Enabled Tools</h2>
            <div className="flex flex-wrap gap-2">
              {agent.tools.enabled.map((tool) => (
                <span
                  key={tool}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Subagents */}
          {agent.subagents && Object.keys(agent.subagents).length > 0 && (
            <div className="border border-border rounded-lg p-6 bg-card">
              <h2 className="text-lg font-semibold mb-4">Subagents</h2>
              <div className="space-y-3">
                {Object.entries(agent.subagents).map(([name, config]) => (
                  <div key={name} className="border border-border rounded p-4">
                    <h3 className="font-semibold text-sm">{name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {config.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg">
              <h3 className="text-lg font-semibold mb-2">Delete Agent?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <strong>{agent.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
