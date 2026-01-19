'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExecutionStore } from '@/lib/stores/executionStore';
import { useChatStore } from '@/lib/stores/chatStore';
import { useAgentStore } from '@/lib/stores/agentStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, GitBranch, Activity } from 'lucide-react';
import { ExecutionStats } from '@/components/execution/ExecutionStats';
import { ExecutionTimeline } from '@/components/execution/ExecutionTimeline';
import { SubagentExecutionTree } from '@/components/execution/SubagentExecutionTree';
import { ExecutionTracker } from '@/lib/services/executionTracker';
import type { ExecutionNode } from '@/lib/types/execution';

export default function ExecutionViewerPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const router = useRouter();
  const { getExecution, getEvents } = useExecutionStore();
  const { getSession } = useChatStore();
  const { getAgent } = useAgentStore();

  const [activeTab, setActiveTab] = useState<'stats' | 'timeline' | 'tree'>('stats');
  const [execution, setExecution] = useState<ExecutionNode | null>(null);

  const session = getSession(sessionId);
  const agent = session ? getAgent(session.agentId) : null;
  const events = getEvents(sessionId);
  const storedExecution = getExecution(sessionId);

  useEffect(() => {
    // If we have a stored execution, use it
    if (storedExecution) {
      setExecution(storedExecution);
    } else if (agent) {
      // Otherwise, build execution tree from events
      const tracker = new ExecutionTracker(sessionId, agent.name);
      const tree = tracker.getExecutionTree();
      setExecution(tree);
    }
  }, [sessionId, storedExecution, agent]);

  if (!session || !agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Session not found</p>
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
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border p-4 bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/chat/${sessionId}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Execution Viewer</h1>
              <p className="text-sm text-muted-foreground">
                {agent.name} • {session.title}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'stats' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('stats')}
            >
              <Activity className="w-4 h-4 mr-2" />
              Statistics
            </Button>
            <Button
              variant={activeTab === 'timeline' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('timeline')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Timeline ({events.length})
            </Button>
            <Button
              variant={activeTab === 'tree' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('tree')}
            >
              <GitBranch className="w-4 h-4 mr-2" />
              Execution Tree
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'stats' && execution && (
            <ExecutionStats execution={execution} />
          )}

          {activeTab === 'timeline' && (
            <ExecutionTimeline events={events} />
          )}

          {activeTab === 'tree' && execution && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h2 className="text-lg font-semibold mb-2">Execution Tree</h2>
                <p className="text-sm text-muted-foreground">
                  Hierarchical view of the agent execution including all subagents, messages, and tool calls.
                  Click on nodes to expand/collapse details.
                </p>
              </div>
              <SubagentExecutionTree node={execution} />
            </div>
          )}

          {/* Empty state */}
          {!execution && events.length === 0 && (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">
                No execution data available yet
              </p>
              <Button
                variant="outline"
                onClick={() => router.push(`/chat/${sessionId}`)}
                className="mt-4"
              >
                Go to Chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
