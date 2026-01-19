'use client';

import { useAgentStore } from '@/lib/stores/agentStore';
import { AgentBuilderForm } from '@/components/agent-builder/AgentBuilderForm';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EditAgentPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { getAgent } = useAgentStore();
  const agent = getAgent(id);

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Agent not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The agent you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push('/')}
          >
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <AgentBuilderForm mode="edit" initialConfig={agent} />
    </div>
  );
}
