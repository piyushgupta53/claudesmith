import { AgentConfig } from '../types/agent';

// Import templates at build time
import codeReviewerTemplate from '../../templates/code-reviewer.json';
import researchAssistantTemplate from '../../templates/research-assistant.json';
import dataAnalystTemplate from '../../templates/data-analyst.json';
import docWriterTemplate from '../../templates/doc-writer.json';
import bugHunterTemplate from '../../templates/bug-hunter.json';
import projectScaffolderTemplate from '../../templates/project-scaffolder.json';
// Orchestrator templates (multi-agent patterns)
import orchestratorCodeReviewTemplate from '../../templates/orchestrator-code-review.json';
import orchestratorResearchTemplate from '../../templates/orchestrator-research.json';
import orchestratorImplementationTemplate from '../../templates/orchestrator-implementation.json';

export const TEMPLATES: Record<string, AgentConfig> = {
  'code-reviewer': codeReviewerTemplate as unknown as AgentConfig,
  'research-assistant': researchAssistantTemplate as unknown as AgentConfig,
  'data-analyst': dataAnalystTemplate as unknown as AgentConfig,
  'doc-writer': docWriterTemplate as unknown as AgentConfig,
  'bug-hunter': bugHunterTemplate as unknown as AgentConfig,
  'project-scaffolder': projectScaffolderTemplate as unknown as AgentConfig,
  // Orchestrator templates
  'orchestrator-code-review': orchestratorCodeReviewTemplate as unknown as AgentConfig,
  'orchestrator-research': orchestratorResearchTemplate as unknown as AgentConfig,
  'orchestrator-implementation': orchestratorImplementationTemplate as unknown as AgentConfig,
};

// Orchestrator template IDs for easy access
export const ORCHESTRATOR_TEMPLATES = [
  'orchestrator-code-review',
  'orchestrator-research',
  'orchestrator-implementation',
] as const;

// Get subagents from an orchestrator template
export function getOrchestratorSubagents(templateId: string): Record<string, any> | null {
  const template = TEMPLATES[templateId];
  if (!template || !template.subagents) return null;
  return template.subagents;
}

export function getAllTemplates(): AgentConfig[] {
  // Filter out templates that require sandbox tools (marked with _requiresSandbox)
  // Only load MVP-compatible templates
  return Object.values(TEMPLATES).filter(template => {
    // Check if template has the _requiresSandbox flag
    const requiresSandbox = (template as any)._requiresSandbox;
    return !requiresSandbox;
  });
}

export function getTemplate(id: string): AgentConfig | null {
  return TEMPLATES[id] || null;
}

export function createAgentFromTemplate(templateId: string): AgentConfig | null {
  const template = getTemplate(templateId);
  if (!template) return null;

  // Create a new agent with a unique ID and current timestamp
  return {
    ...template,
    id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
