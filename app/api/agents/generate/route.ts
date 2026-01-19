import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildMetaAgentPrompt, extractJsonFromResponse, validateGeneratedConfig } from '@/lib/prompts/metaAgentPrompt';
import { skillsManager } from '@/lib/services/skillsManager';
import { useMcpStore } from '@/lib/stores/mcpStore';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * POST /api/agents/generate
 * Generate an agent configuration from natural language input
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Load available skills
    const availableSkills = await skillsManager.listAvailableSkills();

    // Load MCP connections
    const mcpConnections = useMcpStore.getState().listConnections();

    // Build meta-agent prompt
    const metaPrompt = buildMetaAgentPrompt(
      prompt.trim(),
      availableSkills,
      mcpConnections
    );

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: metaPrompt,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    if (!textContent) {
      return Response.json(
        { error: 'No response from Claude' },
        { status: 500 }
      );
    }

    // Extract JSON from response
    const configJson = extractJsonFromResponse(textContent);

    // Parse JSON
    let agentConfig;
    try {
      agentConfig = JSON.parse(configJson);
    } catch (error) {
      console.error('Failed to parse agent config JSON:', error);
      console.error('Raw response:', textContent);
      return Response.json(
        {
          error: 'Failed to parse agent configuration',
          details: 'The AI generated an invalid JSON response. Please try again.',
          rawResponse: textContent.substring(0, 500), // Include first 500 chars for debugging
        },
        { status: 500 }
      );
    }

    // Validate generated config
    const validation = validateGeneratedConfig(agentConfig);
    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid agent configuration',
          details: validation.errors,
          config: agentConfig,
        },
        { status: 400 }
      );
    }

    // Add default values for missing optional fields
    if (!agentConfig.tools.disabled) {
      agentConfig.tools.disabled = [];
    }

    if (!agentConfig.skills) {
      agentConfig.skills = { enabled: [] };
    }

    // Return generated config
    return Response.json({
      success: true,
      config: agentConfig,
    });

  } catch (error: any) {
    console.error('Agent generation error:', error);

    // Handle Anthropic API errors
    if (error.status === 401) {
      return Response.json(
        { error: 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.' },
        { status: 401 }
      );
    }

    if (error.status === 429) {
      return Response.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return Response.json(
      {
        error: 'Failed to generate agent',
        details: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
