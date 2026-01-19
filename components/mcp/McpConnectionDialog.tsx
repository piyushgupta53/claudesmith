'use client';

import { useState, useEffect } from 'react';
import {
  useMcpStore,
  GlobalMcpConnection,
  EXAMPLE_MCP_CONNECTIONS,
  McpTransportType,
  McpConnectionInput,
} from '@/lib/stores/mcpStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Trash2, BookOpen, Terminal, Globe, Radio } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface McpConnectionDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  connection: GlobalMcpConnection | null;
  onClose: () => void;
}

/**
 * Transport type configuration
 */
const TRANSPORT_TYPES: { value: McpTransportType; label: string; description: string; icon: typeof Terminal }[] = [
  {
    value: 'stdio',
    label: 'Stdio (Local)',
    description: 'Run a local process that communicates via stdin/stdout',
    icon: Terminal,
  },
  {
    value: 'http',
    label: 'HTTP (Remote)',
    description: 'Connect to a remote server via Streamable HTTP (recommended)',
    icon: Globe,
  },
  {
    value: 'sse',
    label: 'SSE (Remote)',
    description: 'Connect to a remote server via Server-Sent Events',
    icon: Radio,
  },
];

export function McpConnectionDialog({
  open,
  mode,
  connection,
  onClose,
}: McpConnectionDialogProps) {
  const { addConnection, updateConnection } = useMcpStore();
  const { toast } = useToast();

  // Common fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [transportType, setTransportType] = useState<McpTransportType>('stdio');

  // Stdio-specific fields
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);

  // HTTP/SSE-specific fields
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([]);

  const [showExamples, setShowExamples] = useState(false);

  // Load connection data when editing
  useEffect(() => {
    if (connection) {
      setName(connection.name);
      setDescription(connection.description);
      setTransportType(connection.type);

      // Load type-specific fields
      if (connection.type === 'stdio') {
        setCommand(connection.command);
        setArgs(connection.args || []);
        setEnvVars(
          Object.entries(connection.env || {}).map(([key, value]) => ({ key, value }))
        );
        // Reset URL fields
        setUrl('');
        setHeaders([]);
      } else if (connection.type === 'sse' || connection.type === 'http') {
        setUrl(connection.url);
        setHeaders(
          Object.entries(connection.headers || {}).map(([key, value]) => ({ key, value }))
        );
        // Reset stdio fields
        setCommand('');
        setArgs([]);
        setEnvVars([]);
      }
    } else {
      // Reset form for add mode
      setName('');
      setDescription('');
      setTransportType('stdio');
      setCommand('');
      setArgs([]);
      setEnvVars([]);
      setUrl('');
      setHeaders([]);
    }
  }, [connection, open]);

  const handleSave = () => {
    // Common validation
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Please enter a name for the connection.',
      });
      return;
    }

    // Type-specific validation
    if (transportType === 'stdio') {
      if (!command.trim()) {
        toast({
          variant: 'destructive',
          title: 'Command required',
          description: 'Please enter a command to start the MCP server.',
        });
        return;
      }
    } else {
      if (!url.trim()) {
        toast({
          variant: 'destructive',
          title: 'URL required',
          description: 'Please enter the URL of the MCP server.',
        });
        return;
      }
      // Basic URL validation
      try {
        new URL(url.trim());
      } catch {
        toast({
          variant: 'destructive',
          title: 'Invalid URL',
          description: 'Please enter a valid URL (e.g., https://example.com/mcp).',
        });
        return;
      }
    }

    // Build connection data based on transport type
    let connectionData: McpConnectionInput;

    if (transportType === 'stdio') {
      // Build env object
      const env: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) {
          env[key.trim()] = value;
        }
      });

      connectionData = {
        type: 'stdio',
        name: name.trim(),
        description: description.trim(),
        command: command.trim(),
        args: args.filter(arg => arg.trim()).map(arg => arg.trim()),
        env: Object.keys(env).length > 0 ? env : undefined,
      };
    } else {
      // HTTP or SSE
      const headersObj: Record<string, string> = {};
      headers.forEach(({ key, value }) => {
        if (key.trim()) {
          headersObj[key.trim()] = value;
        }
      });

      connectionData = {
        type: transportType,
        name: name.trim(),
        description: description.trim(),
        url: url.trim(),
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      };
    }

    if (mode === 'edit' && connection) {
      // Extract type from connectionData since updateConnection doesn't allow changing type
      const { type: _type, ...updateData } = connectionData;
      updateConnection(connection.id, updateData);
      toast({
        variant: 'success',
        title: 'Connection updated',
        description: `"${connectionData.name}" has been updated.`,
      });
    } else {
      addConnection(connectionData);
      toast({
        variant: 'success',
        title: 'Connection created',
        description: `"${connectionData.name}" has been created.`,
      });
    }

    onClose();
  };

  const handleAddArg = () => {
    setArgs([...args, '']);
  };

  const handleUpdateArg = (index: number, value: string) => {
    const newArgs = [...args];
    newArgs[index] = value;
    setArgs(newArgs);
  };

  const handleRemoveArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleUpdateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  // Header handlers (for HTTP/SSE)
  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleUpdateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleLoadExample = (example: McpConnectionInput) => {
    setName(example.name);
    setDescription(example.description);
    setTransportType(example.type);

    if (example.type === 'stdio') {
      setCommand(example.command);
      setArgs(example.args || []);
      setEnvVars(
        Object.entries(example.env || {}).map(([key, value]) => ({ key, value }))
      );
      setUrl('');
      setHeaders([]);
    } else {
      setUrl(example.url);
      setHeaders(
        Object.entries(example.headers || {}).map(([key, value]) => ({ key, value }))
      );
      setCommand('');
      setArgs([]);
      setEnvVars([]);
    }
    setShowExamples(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold">
            {mode === 'edit' ? 'Edit MCP Connection' : 'Add MCP Connection'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Example Connections */}
          {mode === 'add' && (
            <div className="border border-border rounded-lg p-3 bg-muted/30">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-2 text-sm font-medium w-full text-left"
              >
                <BookOpen className="w-4 h-4 text-primary" />
                {showExamples ? 'Hide' : 'Show'} Example MCP Servers
              </button>

              {showExamples && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {EXAMPLE_MCP_CONNECTIONS.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleLoadExample(example)}
                      className="w-full text-left border border-border rounded p-2 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{example.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                          example.type === 'stdio' ? 'bg-muted text-muted-foreground' :
                          example.type === 'http' ? 'bg-primary/10 text-primary' :
                          'bg-warning/10 text-warning'
                        }`}>
                          {example.type}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {example.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Name */}
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., GitHub, PostgreSQL, Slack"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this MCP server do?"
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Transport Type Selector */}
          <div>
            <Label>Transport Type *</Label>
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Transport type cannot be changed after creation. Create a new connection to use a different type.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {TRANSPORT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = transportType === type.value;
                const isDisabled = mode === 'edit' && !isSelected;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => mode === 'add' && setTransportType(type.value)}
                    disabled={mode === 'edit'}
                    className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : isDisabled
                        ? 'border-border bg-muted/20 opacity-50 cursor-not-allowed'
                        : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                      {type.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center mt-0.5 leading-tight">
                      {type.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stdio-specific fields */}
          {transportType === 'stdio' && (
            <>
              {/* Command */}
              <div>
                <Label>Command *</Label>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g., npx, node, python"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The executable command to start the MCP server
                </p>
              </div>

              {/* Arguments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Arguments</Label>
                  <Button variant="outline" size="sm" onClick={handleAddArg}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Argument
                  </Button>
                </div>

                {args.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No arguments. Click &quot;Add Argument&quot; to add command-line arguments.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {args.map((arg, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={arg}
                          onChange={(e) => handleUpdateArg(index, e.target.value)}
                          placeholder={`Argument ${index + 1}`}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveArg(index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Environment Variables</Label>
                  <Button variant="outline" size="sm" onClick={handleAddEnvVar}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Variable
                  </Button>
                </div>

                {envVars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No environment variables. Click &quot;Add Variable&quot; to add API keys or config.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {envVars.map((envVar, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={envVar.key}
                          onChange={(e) => handleUpdateEnvVar(index, 'key', e.target.value)}
                          placeholder="KEY"
                          className="flex-1"
                        />
                        <Input
                          value={envVar.value}
                          onChange={(e) => handleUpdateEnvVar(index, 'value', e.target.value)}
                          placeholder="value"
                          type="password"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveEnvVar(index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* HTTP/SSE-specific fields */}
          {(transportType === 'http' || transportType === 'sse') && (
            <>
              {/* URL */}
              <div>
                <Label>URL *</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={transportType === 'http'
                    ? "https://mcp.example.com/api"
                    : "https://mcp.example.com/sse"
                  }
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {transportType === 'http'
                    ? 'The HTTP endpoint URL of the MCP server (Streamable HTTP)'
                    : 'The SSE endpoint URL of the MCP server'
                  }
                </p>
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Headers</Label>
                  <Button variant="outline" size="sm" onClick={handleAddHeader}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Header
                  </Button>
                </div>

                {headers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No headers. Click &quot;Add Header&quot; to add authentication or custom headers.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {headers.map((header, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={header.key}
                          onChange={(e) => handleUpdateHeader(index, 'key', e.target.value)}
                          placeholder="Header-Name"
                          className="flex-1"
                        />
                        <Input
                          value={header.value}
                          onChange={(e) => handleUpdateHeader(index, 'value', e.target.value)}
                          placeholder="value"
                          type="password"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveHeader(index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  Common headers: <code className="bg-muted px-1 rounded">Authorization</code> for API keys,{' '}
                  <code className="bg-muted px-1 rounded">X-API-Key</code> for custom auth
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'edit' ? 'Update Connection' : 'Create Connection'}
          </Button>
        </div>
      </div>
    </div>
  );
}
