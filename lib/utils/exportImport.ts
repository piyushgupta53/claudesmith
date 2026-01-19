import { AgentConfig } from '../types/agent';

/**
 * Export agent configuration as JSON file
 */
export function exportAgentConfig(agent: AgentConfig): void {
  const json = JSON.stringify(agent, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-agent.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import agent configuration from JSON file
 */
export function importAgentConfig(file: File): Promise<AgentConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const config = JSON.parse(json) as AgentConfig;

        // Validate required fields
        if (!config.name || !config.systemPrompt || !config.tools) {
          throw new Error('Invalid agent configuration: missing required fields');
        }

        // Generate new ID for imported agent
        config.id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        config.createdAt = new Date().toISOString();
        config.updatedAt = new Date().toISOString();

        resolve(config);
      } catch (error: any) {
        reject(new Error(`Failed to parse agent config: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Export multiple agents as JSON file
 */
export function exportAllAgents(agents: AgentConfig[]): void {
  const json = JSON.stringify(agents, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `agents-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: Partial<AgentConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.name?.trim()) {
    errors.push('Agent name is required');
  }

  if (!config.systemPrompt?.trim()) {
    errors.push('System prompt is required');
  }

  if (!config.tools?.enabled || config.tools.enabled.length === 0) {
    errors.push('At least one tool must be enabled');
  }

  if (!config.model) {
    errors.push('Model selection is required');
  }

  if (!config.ui?.category) {
    errors.push('Category is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
