import { SkillInfo } from '../services/skillsManager';
import { GlobalMcpConnection } from '../stores/mcpStore';
import { AVAILABLE_TOOLS } from '../types/agent';

/**
 * Build meta-agent prompt for generating agent configurations
 * This prompt is sent to Claude to generate a complete AgentConfig based on user input
 */
export function buildMetaAgentPrompt(
  userInput: string,
  availableSkills: SkillInfo[],
  mcpConnections: GlobalMcpConnection[]
): string {
  const toolsList = Array.from(AVAILABLE_TOOLS).join(', ');
  const skillsList = availableSkills.map(s => `- ${s.name}: ${s.description}`).join('\n');
  const mcpList = mcpConnections.map(m => `- ${m.name} (ID: ${m.id}): ${m.description}`).join('\n');

  return `You are an AI assistant that generates Claude Agent configurations based on natural language descriptions.

## Context

The user wants to create an agent that can perform specific tasks. Your job is to generate a complete, valid agent configuration in JSON format.

## Available Tools

${toolsList}

**Sandbox Tools** (Read, Write, Bash, Grep, Glob, Edit):
- Read: Read files from /project (user's code), /scratch (temp workspace), /skills (skill files)
- Write: Write files to /scratch only (for storing results, intermediate data, reports)
- Bash: Execute safe bash commands (grep, find, jq, sort, etc.) - blocked: rm, sudo, npm, etc.
- Grep: Search file contents with regex patterns
- Glob: Find files by pattern (e.g., **/*.ts)
- Edit: Edit existing files with exact string replacement

**Web Tools**:
- WebSearch: Search the internet for information
- WebFetch: Fetch content from URLs

**Interactive Tools**:
- AskUserQuestion: Ask the user questions for clarification
- TodoWrite: Track tasks and progress

**MCP Tools** (when MCP connections are enabled):
- ListMcpResources: List available resources from MCP servers
- ReadMcpResource: Read specific resources from MCP servers

## Available Skills

${skillsList}

Skills are pre-written guides that teach agents best practices for specific tasks. They are automatically included in the agent's system prompt when enabled.

## Available MCP Connections

${mcpList.length > 0 ? mcpList : 'No MCP connections configured'}

MCP connections allow agents to interact with external services like databases, APIs, and file systems.

## User Request

"${userInput}"

## Your Task

Generate a complete agent configuration that fulfills the user's request. Follow these guidelines:

### 1. System Prompt
- Write clear, detailed instructions for the agent's role and behavior
- **Emphasize using sandbox tools effectively:**
  - Use Read to explore files from /project
  - Use Bash to analyze, compose operations, and process data
  - Use Write to store intermediate results in /scratch
  - Build file-based memory by saving findings to /scratch
- Include specific workflows and best practices
- Be explicit about what the agent should and shouldn't do
- If relevant skills exist, mention they are available for guidance
- **Include these writing best practices for any agent that writes reports or analysis:**

## Writing Best Practices
When writing files, especially analysis reports:
- Write in sections of 2-3KB maximum per Write call
- For large reports, write header first, then append sections incrementally
- Save intermediate findings to separate files before synthesizing
- Prefer structured output (JSON/YAML) over prose when data-heavy
- Example incremental pattern:
  1. Write /scratch/report.md with header and outline
  2. Append each section as analysis completes
  3. Final summary at the end

## MCP/API Best Practices
When using MCP servers (Notion, databases, etc.):
- Use pagination: page_size=20-50 instead of 100 for search queries
- For large pages/documents, retrieve specific sections rather than entire content
- If results exceed size limits, retry with smaller scope
- Process results incrementally rather than fetching everything at once

### 2. Tool Selection
- **Always include Read, Write, Bash if the agent needs file access** (most agents do)
- Include Grep, Glob for searching and finding files
- Include WebSearch, WebFetch if the agent needs to research online
- Include AskUserQuestion if the agent might need clarification
- Include TodoWrite if the task has multiple steps
- Only include tools the agent will actually use

### 3. Skills
- Select skills that match the agent's purpose
- code-review: for code analysis, security checks, quality reviews
- data-analysis: for analyzing datasets, statistics, patterns
- research: for web research, fact verification, reports
- scripting: for bash command patterns and safe operations

### 4. Model Selection
- Use "sonnet" for most agents (balanced cost and capability)
- Use "opus" if the task requires advanced reasoning or complex analysis
- Use "haiku" if the task is simple and cost-sensitive

### 5. UI Metadata
- category: Choose from "general", "code", "research", "analysis", "custom"
- icon: Choose from "Bot", "Code", "Search", "BarChart", "FileText", "Terminal", "Database", "Shield"
- color: Use "#10b981" (emerald) for most agents

### 6. MCP Connections (optional)
- Only include if the user specifically mentions needing database, Slack, GitHub, etc.
- Use the ID from the available MCP connections list

### 7. Error Handling (optional)
- Enable retry if the agent will make many API calls or network requests
- Set fallback model to "haiku" if cost is a concern

### 8. Name and Description
- Name: Short, descriptive (e.g., "Code Reviewer", "Data Analyst")
- Description: One sentence explaining what the agent does

## Output Format

Return ONLY a valid JSON object matching this structure. Do NOT include any explanatory text before or after the JSON:

\`\`\`json
{
  "name": "string",
  "description": "string",
  "systemPrompt": "string (detailed instructions for the agent)",
  "model": "sonnet" | "opus" | "haiku",
  "tools": {
    "enabled": ["array", "of", "tool", "names"],
    "disabled": []
  },
  "skills": {
    "enabled": ["array", "of", "skill", "names"]
  },
  "mcpConnections": ["array", "of", "mcp", "connection", "ids"],
  "errorHandling": {
    "retryOnFailure": boolean,
    "maxRetries": number,
    "retryDelay": number,
    "fallbackModel": "sonnet" | "opus" | "haiku"
  },
  "ui": {
    "category": "general" | "code" | "research" | "analysis" | "custom",
    "icon": "string",
    "color": "#10b981"
  }
}
\`\`\`

## Important Rules

1. Return ONLY the JSON object - no explanations, no markdown code blocks, no additional text
2. The JSON must be valid and parseable
3. Include all required fields: name, description, systemPrompt, model, tools, ui
4. Optional fields (skills, mcpConnections, errorHandling) can be omitted if not needed
5. The system prompt should be comprehensive and actionable
6. Tool selection should be practical - if the agent needs to read files, include Read, Write, Bash
7. Skills should match the agent's purpose

Generate the agent configuration now:`;
}

/**
 * Extract JSON from Claude's response
 * Handles cases where Claude includes markdown code blocks or extra text
 */
export function extractJsonFromResponse(response: string): string {
  // Try to find JSON within markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  // Return as-is if no patterns match
  return response.trim();
}

/**
 * Validate generated agent config
 * Returns errors if the config is invalid
 */
export function validateGeneratedConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Missing or invalid "name" field');
  }

  if (!config.description || typeof config.description !== 'string') {
    errors.push('Missing or invalid "description" field');
  }

  if (!config.systemPrompt || typeof config.systemPrompt !== 'string') {
    errors.push('Missing or invalid "systemPrompt" field');
  }

  if (!config.model || !['sonnet', 'opus', 'haiku'].includes(config.model)) {
    errors.push('Missing or invalid "model" field (must be sonnet, opus, or haiku)');
  }

  if (!config.tools || !config.tools.enabled || !Array.isArray(config.tools.enabled)) {
    errors.push('Missing or invalid "tools.enabled" field');
  }

  if (!config.ui || typeof config.ui !== 'object') {
    errors.push('Missing or invalid "ui" field');
  } else {
    if (!config.ui.category || !['general', 'code', 'research', 'analysis', 'custom'].includes(config.ui.category)) {
      errors.push('Invalid "ui.category" field');
    }
    if (!config.ui.icon || typeof config.ui.icon !== 'string') {
      errors.push('Missing or invalid "ui.icon" field');
    }
    if (!config.ui.color || typeof config.ui.color !== 'string') {
      errors.push('Missing or invalid "ui.color" field');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
