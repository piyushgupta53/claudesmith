/**
 * Example prompts for Instant Mode agent creation
 * These help users understand what kinds of agents they can create
 */

export interface ExamplePrompt {
  label: string;
  prompt: string;
  category: 'code' | 'research' | 'analysis' | 'general';
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: "Code Reviewer",
    category: "code",
    prompt: "Create an agent that reviews my TypeScript code for security vulnerabilities, performance issues, and best practices. It should check for common mistakes like SQL injection, XSS, memory leaks, and suggest improvements. Use the code-review skill and sandbox tools to analyze files in my project."
  },
  {
    label: "Data Analyst",
    category: "analysis",
    prompt: "Build an agent that analyzes CSV and JSON data files. It should calculate statistics (mean, median, mode), find patterns, detect anomalies, and create summary reports. Store intermediate results in /scratch and use the data-analysis skill."
  },
  {
    label: "Research Assistant",
    category: "research",
    prompt: "I need an agent that researches topics on the web, gathers information from multiple sources, verifies facts, and creates comprehensive reports with citations. It should use WebSearch to find sources, WebFetch to read content, and save findings to /scratch with proper attribution."
  },
  {
    label: "Documentation Writer",
    category: "code",
    prompt: "Create an agent that reads my codebase and generates technical documentation. It should explain what each file does, document APIs and functions, create usage examples, and write markdown documentation. Use Read to explore code, Bash to analyze structure, and Write to save docs to /scratch."
  },
  {
    label: "Bug Hunter",
    category: "code",
    prompt: "Build an agent that helps me debug issues in my code. It should analyze error messages, search through logs using Grep, identify root causes, suggest fixes, and explain what went wrong. Use code-review skill and sandbox tools."
  },
  {
    label: "Log Analyzer",
    category: "analysis",
    prompt: "Create an agent that analyzes application logs to find errors, warnings, and patterns. It should identify common issues, track error frequency, detect anomalies, and create summary reports. Use Grep to search logs, Bash to process data, and data-analysis skill."
  },
  {
    label: "API Tester",
    category: "code",
    prompt: "Build an agent that tests REST APIs. It should use WebFetch to make requests, verify responses, check for errors, test edge cases, and document the API behavior. Save test results to /scratch with timestamps."
  },
  {
    label: "Project Organizer",
    category: "general",
    prompt: "Create an agent that helps organize my project files. It should analyze directory structure using Read and Bash, suggest improvements, identify duplicate files, find unused code, and recommend better organization patterns. Use scripting skill."
  },
  {
    label: "Performance Profiler",
    category: "analysis",
    prompt: "Build an agent that analyzes code performance. It should identify slow operations, suggest optimizations, find memory leaks, analyze complexity, and provide actionable recommendations. Use code-review skill and sandbox tools to read and analyze code."
  },
  {
    label: "Security Auditor",
    category: "code",
    prompt: "Create an agent that performs security audits on my code. It should check for vulnerabilities (SQL injection, XSS, CSRF, etc.), verify authentication and authorization, check for exposed secrets, and create a detailed security report. Use code-review skill and be thorough."
  }
];

/**
 * Get example prompts by category
 */
export function getExamplePromptsByCategory(category: ExamplePrompt['category']): ExamplePrompt[] {
  return EXAMPLE_PROMPTS.filter(prompt => prompt.category === category);
}

/**
 * Get random example prompt
 */
export function getRandomExamplePrompt(): ExamplePrompt {
  return EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
}
