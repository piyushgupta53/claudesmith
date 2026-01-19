'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { AgentConfig, JSONSchema } from '@/lib/types/agent';
import { FileJson, Info, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OutputFormatTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

// Example schemas for quick start
const EXAMPLE_SCHEMAS: Record<string, { label: string; schema: JSONSchema; description: string }> = {
  simple: {
    label: 'Simple Object',
    description: 'A basic object with name and value',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name' },
        value: { type: 'number', description: 'The value' }
      },
      required: ['name']
    }
  },
  array: {
    label: 'Array of Items',
    description: 'An object containing an array of items',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              completed: { type: 'boolean' }
            },
            required: ['id', 'title']
          }
        }
      },
      required: ['items']
    }
  },
  analysis: {
    label: 'Data Analysis Report',
    description: 'Structured report with summary and findings',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Executive summary' },
        findings: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of key findings'
        },
        metrics: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            average: { type: 'number' },
            max: { type: 'number' },
            min: { type: 'number' }
          }
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['summary', 'findings']
    }
  }
};

export function OutputFormatTab({ config, onChange }: OutputFormatTabProps) {
  const [schemaText, setSchemaText] = useState(
    config.outputFormat?.schema
      ? JSON.stringify(config.outputFormat.schema, null, 2)
      : ''
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isEnabled = !!config.outputFormat;

  const toggleOutputFormat = () => {
    if (isEnabled) {
      // Disable
      onChange({ outputFormat: undefined });
      setSchemaText('');
      setSchemaError(null);
    } else {
      // Enable with empty schema
      const defaultSchema: JSONSchema = {
        type: 'object',
        properties: {}
      };
      onChange({
        outputFormat: {
          type: 'json_schema',
          schema: defaultSchema
        }
      });
      setSchemaText(JSON.stringify(defaultSchema, null, 2));
    }
  };

  const handleSchemaChange = (value: string) => {
    setSchemaText(value);
    setSchemaError(null);

    // Try to parse JSON
    if (!value.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(value);
      onChange({
        outputFormat: {
          type: 'json_schema',
          schema: parsed
        }
      });
    } catch (err: any) {
      setSchemaError(err.message);
    }
  };

  const loadExample = (exampleKey: string) => {
    const example = EXAMPLE_SCHEMAS[exampleKey];
    if (example) {
      const schemaStr = JSON.stringify(example.schema, null, 2);
      setSchemaText(schemaStr);
      handleSchemaChange(schemaStr);
    }
  };

  const copySchema = () => {
    navigator.clipboard.writeText(schemaText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>Structured Output</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your agent to return structured data following a JSON schema
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What is Structured Output?
            </h4>
            <p className="text-xs text-muted-foreground">
              When enabled, your agent will return data in a specific JSON format that you define.
              This is useful for data extraction, form filling, API responses, and any scenario
              where you need predictable, parseable output.
            </p>
          </div>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileJson className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <Label>Enable Structured Output</Label>
              <button
                type="button"
                onClick={toggleOutputFormat}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  isEnabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure your agent to return responses in a structured JSON format
            </p>
          </div>
        </div>
      </div>

      {/* Schema Editor */}
      {isEnabled && (
        <>
          {/* Example Schemas */}
          <div>
            <Label className="mb-2 block">Example Schemas</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(EXAMPLE_SCHEMAS).map(([key, example]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => loadExample(key)}
                  className="p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                >
                  <div className="font-medium text-sm mb-1">{example.label}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {example.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* JSON Schema Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>JSON Schema</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={copySchema}
                disabled={!schemaText.trim()}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <textarea
              value={schemaText}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder={`{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" },\n    "age": { "type": "number" }\n  },\n  "required": ["name"]\n}`}
              className="w-full h-64 p-3 rounded-lg border border-border bg-muted/30 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              spellCheck={false}
            />

            {schemaError && (
              <p className="text-xs text-destructive mt-2">
                Invalid JSON: {schemaError}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              Define the structure of the JSON output your agent should return.
              Use standard JSON Schema format.
            </p>
          </div>

          {/* JSON Schema Reference */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">JSON Schema Quick Reference</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-medium mb-1">Data Types</div>
                <ul className="text-muted-foreground space-y-1">
                  <li><code className="font-mono">string</code> - Text data</li>
                  <li><code className="font-mono">number</code> - Numeric values</li>
                  <li><code className="font-mono">boolean</code> - true/false</li>
                  <li><code className="font-mono">array</code> - List of items</li>
                  <li><code className="font-mono">object</code> - Nested structure</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Common Keywords</div>
                <ul className="text-muted-foreground space-y-1">
                  <li><code className="font-mono">properties</code> - Object fields</li>
                  <li><code className="font-mono">required</code> - Required fields</li>
                  <li><code className="font-mono">items</code> - Array item type</li>
                  <li><code className="font-mono">description</code> - Field docs</li>
                  <li><code className="font-mono">enum</code> - Allowed values</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
