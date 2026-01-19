'use client';

import { useState } from 'react';
import { useMcpStore, GlobalMcpConnection, EXAMPLE_MCP_CONNECTIONS } from '@/lib/stores/mcpStore';
import { Button } from '@/components/ui/button';
import { Plus, Settings2, Trash2, Copy, AlertCircle } from 'lucide-react';
import { McpConnectionDialog } from './McpConnectionDialog';
import { McpConnectionCard } from './McpConnectionCard';
import { useToast } from '@/components/ui/use-toast';

export function McpManager() {
  const { connections, deleteConnection } = useMcpStore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedConnection, setSelectedConnection] = useState<GlobalMcpConnection | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const connectionsList = Array.from(connections.values());

  const handleAddConnection = () => {
    setDialogMode('add');
    setSelectedConnection(null);
    setDialogOpen(true);
  };

  const handleEditConnection = (connection: GlobalMcpConnection) => {
    setDialogMode('edit');
    setSelectedConnection(connection);
    setDialogOpen(true);
  };

  const handleDeleteConnection = (id: string) => {
    if (deleteConfirm === id) {
      deleteConnection(id);
      setDeleteConfirm(null);
      toast({
        variant: 'success',
        title: 'Connection deleted',
        description: 'MCP connection has been removed.',
      });
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleDuplicateConnection = (connection: GlobalMcpConnection) => {
    setDialogMode('add');
    setSelectedConnection({
      ...connection,
      name: `${connection.name} (Copy)`,
    } as GlobalMcpConnection);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedConnection(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            MCP Connections
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Model Context Protocol server connections that can be shared across agents
          </p>
        </div>

        <Button onClick={handleAddConnection}>
          <Plus className="w-4 h-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What are MCP Connections?
            </h4>
            <p className="text-xs text-muted-foreground">
              MCP (Model Context Protocol) allows agents to connect to external services like
              databases, APIs, file systems, and more. Create global connections here, then
              enable them in your agents.
            </p>
          </div>
        </div>
      </div>

      {/* Connections List */}
      {connectionsList.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center">
          <Settings2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No MCP connections yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first MCP connection to enable external integrations for your agents.
          </p>
          <Button onClick={handleAddConnection}>
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </Button>

          {/* Example Connections */}
          <div className="mt-8 pt-8 border-t border-border">
            <h4 className="font-semibold text-sm mb-3">Example MCP Servers</h4>
            <div className="grid gap-3 text-left">
              {EXAMPLE_MCP_CONNECTIONS.slice(0, 3).map((example, index) => (
                <div
                  key={index}
                  className="border border-border rounded-lg p-3 bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{example.name}</h5>
                      <p className="text-xs text-muted-foreground mt-1">
                        {example.description}
                      </p>
                      <code className="text-xs font-mono text-muted-foreground mt-2 block">
                        {example.type === 'stdio'
                          ? `${example.command} ${example.args?.join(' ') || ''}`
                          : example.url}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {connectionsList.map((connection) => (
            <McpConnectionCard
              key={connection.id}
              connection={connection}
              onEdit={() => handleEditConnection(connection)}
              onDelete={() => handleDeleteConnection(connection.id)}
              onDuplicate={() => handleDuplicateConnection(connection)}
              deleteConfirm={deleteConfirm === connection.id}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <McpConnectionDialog
        open={dialogOpen}
        mode={dialogMode}
        connection={selectedConnection}
        onClose={handleDialogClose}
      />
    </div>
  );
}
