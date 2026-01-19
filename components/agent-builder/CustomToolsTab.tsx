'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentConfig, JSONSchema } from '@/lib/types/agent';
import { Wrench, Plus, Trash2, Info, BookOpen, AlertCircle, Check, Code, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomToolsTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

interface CustomTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: string;
}

// Tool presets for common use cases
const TOOL_PRESETS: Record<string, { label: string; description: string; tool: CustomTool; category: 'data' | 'text' | 'utility' }> = {
  calculator: {
    label: 'Calculator',
    description: 'Perform basic math operations',
    category: 'data',
    tool: {
      name: 'calculator',
      description: 'Perform basic mathematical operations (add, subtract, multiply, divide)',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'The mathematical operation to perform'
          },
          a: {
            type: 'number',
            description: 'First operand'
          },
          b: {
            type: 'number',
            description: 'Second operand'
          }
        },
        required: ['operation', 'a', 'b']
      },
      handler: `const { operation, a, b } = args;
let result;
switch (operation) {
  case 'add': result = a + b; break;
  case 'subtract': result = a - b; break;
  case 'multiply': result = a * b; break;
  case 'divide': result = b !== 0 ? a / b : 'Error: Division by zero'; break;
  default: result = 'Unknown operation';
}
return \`Result: \${result}\`;`
    }
  },
  textTransformer: {
    label: 'Text Transformer',
    description: 'Transform text (uppercase, lowercase, reverse, etc.)',
    category: 'text',
    tool: {
      name: 'transform_text',
      description: 'Transform text in various ways (uppercase, lowercase, reverse, title case)',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to transform'
          },
          transformation: {
            type: 'string',
            enum: ['uppercase', 'lowercase', 'reverse', 'titlecase', 'trim'],
            description: 'The transformation to apply'
          }
        },
        required: ['text', 'transformation']
      },
      handler: `const { text, transformation } = args;
let result;
switch (transformation) {
  case 'uppercase': result = text.toUpperCase(); break;
  case 'lowercase': result = text.toLowerCase(); break;
  case 'reverse': result = text.split('').reverse().join(''); break;
  case 'titlecase': result = text.replace(/\\b\\w/g, c => c.toUpperCase()); break;
  case 'trim': result = text.trim(); break;
  default: result = text;
}
return result;`
    }
  },
  dataFormatter: {
    label: 'Data Formatter',
    description: 'Format data as JSON, CSV, or table',
    category: 'data',
    tool: {
      name: 'format_data',
      description: 'Format data in various output formats (JSON, CSV, markdown table)',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of objects to format'
          },
          format: {
            type: 'string',
            enum: ['json', 'csv', 'table'],
            description: 'Output format'
          }
        },
        required: ['data', 'format']
      },
      handler: `const { data, format } = args;
if (!Array.isArray(data) || data.length === 0) {
  return 'Error: data must be a non-empty array';
}

const keys = Object.keys(data[0]);

switch (format) {
  case 'json':
    return JSON.stringify(data, null, 2);
  case 'csv':
    const header = keys.join(',');
    const rows = data.map(row => keys.map(k => row[k]).join(','));
    return [header, ...rows].join('\\n');
  case 'table':
    const thRow = '| ' + keys.join(' | ') + ' |';
    const separator = '| ' + keys.map(() => '---').join(' | ') + ' |';
    const tdRows = data.map(row => '| ' + keys.map(k => row[k]).join(' | ') + ' |');
    return [thRow, separator, ...tdRows].join('\\n');
  default:
    return JSON.stringify(data);
}`
    }
  },
  randomGenerator: {
    label: 'Random Generator',
    description: 'Generate random numbers, strings, or UUIDs',
    category: 'utility',
    tool: {
      name: 'random_generate',
      description: 'Generate random values (numbers, strings, UUIDs, colors)',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['number', 'string', 'uuid', 'color', 'boolean'],
            description: 'Type of random value to generate'
          },
          min: {
            type: 'number',
            description: 'Minimum value (for numbers)'
          },
          max: {
            type: 'number',
            description: 'Maximum value (for numbers)'
          },
          length: {
            type: 'number',
            description: 'Length of string to generate'
          }
        },
        required: ['type']
      },
      handler: `const { type, min = 0, max = 100, length = 8 } = args;

switch (type) {
  case 'number':
    return Math.floor(Math.random() * (max - min + 1)) + min;
  case 'string':
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let str = '';
    for (let i = 0; i < length; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  case 'uuid':
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  case 'color':
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  case 'boolean':
    return Math.random() < 0.5;
  default:
    return 'Unknown type';
}`
    }
  },
  timestampUtil: {
    label: 'Timestamp Utility',
    description: 'Work with dates and timestamps',
    category: 'utility',
    tool: {
      name: 'timestamp_util',
      description: 'Convert and format timestamps and dates',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['now', 'format', 'parse', 'diff'],
            description: 'Action to perform'
          },
          timestamp: {
            type: 'number',
            description: 'Unix timestamp in milliseconds'
          },
          date: {
            type: 'string',
            description: 'Date string to parse'
          },
          format: {
            type: 'string',
            enum: ['iso', 'locale', 'unix', 'relative'],
            description: 'Output format'
          }
        },
        required: ['action']
      },
      handler: `const { action, timestamp, date, format = 'iso' } = args;

const formatDate = (d, fmt) => {
  switch (fmt) {
    case 'iso': return d.toISOString();
    case 'locale': return d.toLocaleString();
    case 'unix': return d.getTime();
    case 'relative':
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' minutes ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
      return Math.floor(diff / 86400000) + ' days ago';
    default: return d.toISOString();
  }
};

switch (action) {
  case 'now':
    return formatDate(new Date(), format);
  case 'format':
    return formatDate(new Date(timestamp || Date.now()), format);
  case 'parse':
    return new Date(date).getTime();
  case 'diff':
    const d1 = new Date(timestamp || Date.now());
    const d2 = new Date(date || Date.now());
    return Math.abs(d1 - d2) + ' ms';
  default:
    return 'Unknown action';
}`
    }
  },
  stringAnalyzer: {
    label: 'String Analyzer',
    description: 'Analyze text for word count, character count, etc.',
    category: 'text',
    tool: {
      name: 'analyze_string',
      description: 'Analyze a string for various metrics (word count, character count, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to analyze'
          }
        },
        required: ['text']
      },
      handler: `const { text } = args;
const words = text.trim().split(/\\s+/).filter(w => w.length > 0);
const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
const paragraphs = text.split(/\\n\\n+/).filter(p => p.trim().length > 0);

return {
  content: [{
    type: 'text',
    text: JSON.stringify({
      characters: text.length,
      charactersNoSpaces: text.replace(/\\s/g, '').length,
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      averageWordLength: words.length > 0
        ? (words.reduce((sum, w) => sum + w.length, 0) / words.length).toFixed(2)
        : 0
    }, null, 2)
  }]
};`
    }
  }
};

// Blocked patterns for code validation (simplified client-side check)
const BLOCKED_PATTERNS = [
  /process\s*\./,
  /child_process/,
  /require\s*\(/,
  /import\s*\(/,
  /import\s+.*from/,
  /fs\s*\./,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /Function\s*\(/,
  /__proto__/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
];

const BLOCKED_GLOBALS = [
  'process', 'child_process', 'fs', 'require', 'import', 'eval', 'Function',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'globalThis', 'global', 'window'
];

// Client-side code validation
function validateCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Code cannot be empty' };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, error: `Code contains blocked pattern: ${pattern.source}` };
    }
  }

  for (const global of BLOCKED_GLOBALS) {
    const regex = new RegExp(`\\b${global}\\b`);
    if (regex.test(code)) {
      return { valid: false, error: `Code references blocked global: ${global}` };
    }
  }

  return { valid: true };
}

// Validate JSON Schema
function validateSchema(schemaStr: string): { valid: boolean; error?: string; schema?: JSONSchema } {
  try {
    const schema = JSON.parse(schemaStr);

    if (typeof schema !== 'object' || schema === null) {
      return { valid: false, error: 'Schema must be an object' };
    }

    if (!schema.type) {
      return { valid: false, error: 'Schema must have a "type" property' };
    }

    if (schema.type !== 'object') {
      return { valid: false, error: 'Root schema type must be "object"' };
    }

    return { valid: true, schema };
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}` };
  }
}

// Validate tool name
function validateToolName(name: string, existingNames: string[], currentIndex: number): { valid: boolean; error?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Tool name is required' };
  }

  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return { valid: false, error: 'Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' };
  }

  const isDuplicate = existingNames.some((n, i) => n === name && i !== currentIndex);
  if (isDuplicate) {
    return { valid: false, error: 'A tool with this name already exists' };
  }

  return { valid: true };
}

export function CustomToolsTab({ config, onChange }: CustomToolsTabProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [editingTool, setEditingTool] = useState<{ index: number } | null>(null);
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [toolSchema, setToolSchema] = useState('');
  const [toolHandler, setToolHandler] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const customTools = config.customTools || [];

  // Validation states
  const nameValidation = validateToolName(toolName, customTools.map(t => t.name), editingTool?.index ?? -1);
  const schemaValidation = toolSchema ? validateSchema(toolSchema) : { valid: false, error: 'Schema is required' };
  const codeValidation = toolHandler ? validateCode(toolHandler) : { valid: false, error: 'Handler code is required' };

  const canSave = nameValidation.valid &&
                  schemaValidation.valid &&
                  codeValidation.valid &&
                  toolDescription.trim().length > 0;

  const addTool = () => {
    setEditingTool({ index: -1 });
    setToolName('');
    setToolDescription('');
    setToolSchema(JSON.stringify({
      type: 'object',
      properties: {},
      required: []
    }, null, 2));
    setToolHandler('// Access args.propertyName for input parameters\n// Return a string or { content: [{ type: "text", text: "..." }] }\n\nreturn `Hello!`;');
  };

  const editTool = (index: number) => {
    const tool = customTools[index];
    if (tool) {
      setEditingTool({ index });
      setToolName(tool.name);
      setToolDescription(tool.description);
      setToolSchema(JSON.stringify(tool.inputSchema, null, 2));
      setToolHandler(tool.handler);
    }
  };

  const saveTool = () => {
    if (!canSave || !schemaValidation.schema) return;

    const newTool: CustomTool = {
      name: toolName.trim(),
      description: toolDescription.trim(),
      inputSchema: schemaValidation.schema,
      handler: toolHandler.trim()
    };

    let updatedTools: CustomTool[];
    if (editingTool?.index === -1) {
      updatedTools = [...customTools, newTool];
    } else if (editingTool) {
      updatedTools = [...customTools];
      updatedTools[editingTool.index] = newTool;
    } else {
      return;
    }

    onChange({ customTools: updatedTools });
    cancelEdit();
  };

  const deleteTool = (index: number) => {
    const updatedTools = customTools.filter((_, i) => i !== index);
    onChange({ customTools: updatedTools.length > 0 ? updatedTools : undefined });
    setDeleteConfirm(null);
  };

  const loadPreset = (presetKey: string) => {
    const preset = TOOL_PRESETS[presetKey];
    if (preset) {
      setEditingTool({ index: -1 });
      setToolName(preset.tool.name);
      setToolDescription(preset.tool.description);
      setToolSchema(JSON.stringify(preset.tool.inputSchema, null, 2));
      setToolHandler(preset.tool.handler);
      setShowPresets(false);
    }
  };

  const cancelEdit = () => {
    setEditingTool(null);
    setToolName('');
    setToolDescription('');
    setToolSchema('');
    setToolHandler('');
  };

  const getToolCount = () => customTools.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>Custom Tools</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Define custom tools with JavaScript handlers to extend your agent&apos;s capabilities
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What are Custom Tools?
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Custom tools let you create new capabilities for your agent using JavaScript. Each tool has:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
              <li><strong>Name:</strong> A unique identifier (lowercase, no spaces)</li>
              <li><strong>Description:</strong> What the tool does (shown to the agent)</li>
              <li><strong>Input Schema:</strong> JSON Schema defining expected parameters</li>
              <li><strong>Handler:</strong> JavaScript code that runs when the tool is called</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Handler receives:</strong> <code className="bg-muted px-1 rounded">args</code> (validated input) and <code className="bg-muted px-1 rounded">context</code> (execution context).
              Return a string or <code className="bg-muted px-1 rounded">{`{ content: [{ type: "text", text: "..." }] }`}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Tool Presets */}
      <div className="border border-border rounded-lg bg-card">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium text-sm">Tool Templates</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Start from pre-built templates for common use cases
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {showPresets ? 'Hide' : 'Show'}
          </div>
        </button>

        {showPresets && (
          <div className="border-t border-border p-4 space-y-4">
            {/* Data Tools */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Data Processing</div>
              <div className="space-y-2">
                {Object.entries(TOOL_PRESETS)
                  .filter(([, preset]) => preset.category === 'data')
                  .map(([key, preset]) => (
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
                          {preset.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Tools */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Text Processing</div>
              <div className="space-y-2">
                {Object.entries(TOOL_PRESETS)
                  .filter(([, preset]) => preset.category === 'text')
                  .map(([key, preset]) => (
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
                          {preset.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Utility Tools */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utility</div>
              <div className="space-y-2">
                {Object.entries(TOOL_PRESETS)
                  .filter(([, preset]) => preset.category === 'utility')
                  .map(([key, preset]) => (
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
                          {preset.description}
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

      {/* Tool Editor */}
      {editingTool && (
        <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            {editingTool.index === -1 ? 'Add Custom Tool' : 'Edit Custom Tool'}
          </h3>

          <div className="space-y-4">
            {/* Tool Name */}
            <div>
              <Label className="text-xs">Tool Name</Label>
              <Input
                value={toolName}
                onChange={(e) => setToolName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g., calculate_sum"
                className={cn("mt-1", !nameValidation.valid && toolName && "border-destructive")}
              />
              {!nameValidation.valid && toolName && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {nameValidation.error}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Exposed as: mcp__custom-tools-{config.id || '{agentId}'}__{toolName || '{name}'}
              </p>
            </div>

            {/* Tool Description */}
            <div>
              <Label className="text-xs">Description</Label>
              <textarea
                value={toolDescription}
                onChange={(e) => setToolDescription(e.target.value)}
                placeholder="Describe what this tool does (shown to the agent)"
                className="w-full h-16 p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary mt-1"
              />
              {!toolDescription.trim() && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Description is required
                </p>
              )}
            </div>

            {/* JSON Schema */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-xs">Input Schema (JSON Schema)</Label>
                <FileJson className="w-3 h-3 text-muted-foreground" />
              </div>
              <textarea
                value={toolSchema}
                onChange={(e) => setToolSchema(e.target.value)}
                placeholder='{ "type": "object", "properties": { ... }, "required": [...] }'
                className={cn(
                  "w-full h-40 p-3 rounded-lg border bg-background font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary mt-1",
                  !schemaValidation.valid && toolSchema && "border-destructive"
                )}
                spellCheck={false}
              />
              {!schemaValidation.valid && toolSchema && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {schemaValidation.error}
                </p>
              )}
              {schemaValidation.valid && (
                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Valid JSON Schema
                </p>
              )}
            </div>

            {/* Handler Code */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-xs">Handler Code (JavaScript)</Label>
                <Code className="w-3 h-3 text-muted-foreground" />
              </div>
              <textarea
                value={toolHandler}
                onChange={(e) => setToolHandler(e.target.value)}
                placeholder={`// Access input via args object
const { param1, param2 } = args;

// Perform operations
const result = doSomething(param1, param2);

// Return result
return result;`}
                className={cn(
                  "w-full h-48 p-3 rounded-lg border bg-background font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary mt-1",
                  !codeValidation.valid && toolHandler && "border-destructive"
                )}
                spellCheck={false}
              />
              {!codeValidation.valid && toolHandler && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {codeValidation.error}
                </p>
              )}
              {codeValidation.valid && (
                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Code validation passed
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Security:</strong> Code runs in a sandboxed environment. Blocked: process, fs, require, import, eval, fetch, network APIs.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={saveTool} size="sm" disabled={!canSave}>
                {editingTool.index === -1 ? 'Add Tool' : 'Save Changes'}
              </Button>
              <Button onClick={cancelEdit} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tool Button (when not editing) */}
      {!editingTool && (
        <Button onClick={addTool} variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Custom Tool
        </Button>
      )}

      {/* Tool List */}
      {customTools.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Configured Tools ({customTools.length})
          </Label>

          {customTools.map((tool, index) => (
            <div
              key={index}
              className={cn(
                "border rounded-lg p-4 bg-card",
                editingTool?.index === index && "border-primary bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">{tool.name}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {tool.description}
                  </p>

                  {/* Schema Preview */}
                  <div className="bg-muted/50 rounded p-2 mb-2">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <FileJson className="w-3 h-3" />
                      Input Schema
                    </div>
                    <pre className="text-xs font-mono overflow-x-auto max-h-20 text-muted-foreground">
                      {JSON.stringify(tool.inputSchema.properties || {}, null, 2).slice(0, 200)}
                      {JSON.stringify(tool.inputSchema.properties || {}).length > 200 && '...'}
                    </pre>
                  </div>

                  {/* Handler Preview */}
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Code className="w-3 h-3" />
                      Handler
                    </div>
                    <pre className="text-xs font-mono overflow-x-auto text-muted-foreground">
                      {tool.handler.split('\n')[0]}
                      {tool.handler.split('\n').length > 1 && '...'}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editTool(index)}
                    disabled={editingTool !== null}
                  >
                    Edit
                  </Button>
                  {deleteConfirm === index ? (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTool(index)}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(index)}
                      disabled={editingTool !== null}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {getToolCount()} custom tool{getToolCount() !== 1 ? 's' : ''} configured
      </div>
    </div>
  );
}
