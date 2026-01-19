/**
 * Connector MCP Server
 * Provides tools for agents to access connected OAuth services
 *
 * This server is created dynamically based on which connectors are enabled
 * for an agent. Tools call external APIs using stored OAuth tokens.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import type { OAuthProvider, OAuthTokens } from '../types/connector';
import { getProviderConfig } from '../connectors/providers';

// ============================================================
// Types
// ============================================================

interface ConnectorContext {
  connectionId: string;
  provider: OAuthProvider;
  getAccessToken: () => Promise<string>;
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ============================================================
// Helper Functions
// ============================================================

function successResult(data: unknown): ToolResult {
  return {
    content: [{
      type: 'text' as const,
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    }],
  };
}

function errorResult(message: string): ToolResult {
  return {
    content: [{
      type: 'text' as const,
      text: message,
    }],
    isError: true,
  };
}

async function fetchWithAuth(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

// ============================================================
// Gmail Tools
// ============================================================

const gmailListTool = tool(
  'gmail_list',
  'List emails from Gmail inbox. Returns message IDs, snippets, and basic metadata.',
  {
    maxResults: z.number().optional().default(10).describe('Maximum number of emails to return (default: 10, max: 100)'),
    query: z.string().optional().describe('Gmail search query (e.g., "from:example@gmail.com", "is:unread", "subject:report")'),
    labelIds: z.array(z.string()).optional().describe('Filter by label IDs (e.g., ["INBOX", "UNREAD"])'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Gmail connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('maxResults', String(Math.min(args.maxResults || 10, 100)));

      if (args.query) {
        params.set('q', args.query);
      }
      if (args.labelIds?.length) {
        args.labelIds.forEach(label => params.append('labelIds', label));
      }

      const response = await fetchWithAuth(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        accessToken
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`Failed to list emails: ${error}`);
      }

      const data = await response.json();
      const messages = data.messages || [];

      // Fetch snippets for each message
      const enrichedMessages = await Promise.all(
        messages.slice(0, 20).map(async (msg: { id: string }) => {
          const detailResponse = await fetchWithAuth(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            accessToken
          );

          if (!detailResponse.ok) {
            return { id: msg.id, error: 'Failed to fetch details' };
          }

          const detail = await detailResponse.json();
          const headers = detail.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id: msg.id,
            threadId: detail.threadId,
            snippet: detail.snippet,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            labelIds: detail.labelIds,
          };
        })
      );

      return successResult({
        count: data.resultSizeEstimate || messages.length,
        messages: enrichedMessages,
      });
    } catch (error) {
      return errorResult(`Gmail error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const gmailReadTool = tool(
  'gmail_read',
  'Read a specific email message by ID. Returns full message content.',
  {
    messageId: z.string().describe('The email message ID to read'),
    format: z.enum(['full', 'minimal', 'metadata']).optional().default('full').describe('Response format'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Gmail connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const response = await fetchWithAuth(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${args.messageId}?format=${args.format}`,
        accessToken
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`Failed to read email: ${error}`);
      }

      const message = await response.json();

      // Parse message body
      let body = '';
      if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find(
          (p: any) => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      const headers = message.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      return successResult({
        id: message.id,
        threadId: message.threadId,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        body: body.slice(0, 10000), // Limit body size
        labelIds: message.labelIds,
      });
    } catch (error) {
      return errorResult(`Gmail error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// ============================================================
// Google Drive Tools
// ============================================================

const driveListTool = tool(
  'drive_list',
  'List files in Google Drive. Returns file IDs, names, and metadata.',
  {
    maxResults: z.number().optional().default(20).describe('Maximum number of files to return (default: 20, max: 100)'),
    query: z.string().optional().describe("Drive search query (e.g., \"name contains 'report'\", \"mimeType='application/pdf'\")"),
    folderId: z.string().optional().describe('List files in a specific folder'),
    orderBy: z.string().optional().default('modifiedTime desc').describe('Sort order (e.g., "modifiedTime desc", "name")'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Drive connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('pageSize', String(Math.min(args.maxResults || 20, 100)));
      params.set('fields', 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)');

      let query = args.query || '';
      if (args.folderId) {
        const folderQuery = `'${args.folderId}' in parents`;
        query = query ? `${query} and ${folderQuery}` : folderQuery;
      }
      if (query) {
        params.set('q', query);
      }
      if (args.orderBy) {
        params.set('orderBy', args.orderBy);
      }

      const response = await fetchWithAuth(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        accessToken
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`Failed to list files: ${error}`);
      }

      const data = await response.json();

      return successResult({
        count: data.files?.length || 0,
        files: data.files || [],
      });
    } catch (error) {
      return errorResult(`Drive error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const driveReadTool = tool(
  'drive_read',
  'Read contents of a file from Google Drive. Supports text files and Google Docs.',
  {
    fileId: z.string().describe('The file ID to read'),
    exportMimeType: z.string().optional().describe('For Google Docs: export format (e.g., "text/plain", "application/pdf")'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Drive connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();

      // First, get file metadata to determine type
      const metaResponse = await fetchWithAuth(
        `https://www.googleapis.com/drive/v3/files/${args.fileId}?fields=id,name,mimeType,size`,
        accessToken
      );

      if (!metaResponse.ok) {
        const error = await metaResponse.text();
        return errorResult(`Failed to get file info: ${error}`);
      }

      const metadata = await metaResponse.json();

      // Determine how to read the file
      let url: string;
      const isGoogleDoc = metadata.mimeType.startsWith('application/vnd.google-apps.');

      if (isGoogleDoc) {
        // Export Google Docs
        const exportType = args.exportMimeType || 'text/plain';
        url = `https://www.googleapis.com/drive/v3/files/${args.fileId}/export?mimeType=${encodeURIComponent(exportType)}`;
      } else {
        // Download regular files
        url = `https://www.googleapis.com/drive/v3/files/${args.fileId}?alt=media`;
      }

      const response = await fetchWithAuth(url, accessToken);

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`Failed to read file: ${error}`);
      }

      // Limit file size
      const content = await response.text();
      const truncated = content.length > 50000;

      return successResult({
        id: metadata.id,
        name: metadata.name,
        mimeType: metadata.mimeType,
        content: truncated ? content.slice(0, 50000) + '\n\n[Content truncated...]' : content,
        truncated,
      });
    } catch (error) {
      return errorResult(`Drive error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const driveSearchTool = tool(
  'drive_search',
  'Search for files in Google Drive by name or content.',
  {
    query: z.string().describe('Search query - matches file name and content'),
    maxResults: z.number().optional().default(10).describe('Maximum results to return'),
    fileType: z.string().optional().describe('Filter by file type (e.g., "document", "spreadsheet", "folder")'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Drive connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('pageSize', String(Math.min(args.maxResults || 10, 50)));
      params.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink)');

      // Build search query
      let searchQuery = `fullText contains '${args.query}'`;
      if (args.fileType) {
        const mimeTypes: Record<string, string> = {
          document: 'application/vnd.google-apps.document',
          spreadsheet: 'application/vnd.google-apps.spreadsheet',
          presentation: 'application/vnd.google-apps.presentation',
          folder: 'application/vnd.google-apps.folder',
          pdf: 'application/pdf',
        };
        const mimeType = mimeTypes[args.fileType];
        if (mimeType) {
          searchQuery += ` and mimeType='${mimeType}'`;
        }
      }
      params.set('q', searchQuery);

      const response = await fetchWithAuth(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        accessToken
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`Search failed: ${error}`);
      }

      const data = await response.json();

      return successResult({
        query: args.query,
        count: data.files?.length || 0,
        files: data.files || [],
      });
    } catch (error) {
      return errorResult(`Drive error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// ============================================================
// Slack Tools
// ============================================================

const slackListChannelsTool = tool(
  'slack_list_channels',
  'List channels in the Slack workspace.',
  {
    excludeArchived: z.boolean().optional().default(true).describe('Exclude archived channels'),
    limit: z.number().optional().default(100).describe('Maximum channels to return'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Slack connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('exclude_archived', String(args.excludeArchived));
      params.set('limit', String(Math.min(args.limit || 100, 1000)));

      const response = await fetchWithAuth(
        `https://slack.com/api/conversations.list?${params}`,
        accessToken
      );

      const data = await response.json();

      if (!data.ok) {
        return errorResult(`Slack API error: ${data.error}`);
      }

      const channels = (data.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
        isMember: ch.is_member,
        topic: ch.topic?.value,
        purpose: ch.purpose?.value,
      }));

      return successResult({
        count: channels.length,
        channels,
      });
    } catch (error) {
      return errorResult(`Slack error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const slackReadTool = tool(
  'slack_read',
  'Read messages from a Slack channel.',
  {
    channel: z.string().describe('Channel ID to read messages from'),
    limit: z.number().optional().default(20).describe('Number of messages to fetch'),
    oldest: z.string().optional().describe('Start of time range (Unix timestamp)'),
    latest: z.string().optional().describe('End of time range (Unix timestamp)'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Slack connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('channel', args.channel);
      params.set('limit', String(Math.min(args.limit || 20, 100)));
      if (args.oldest) params.set('oldest', args.oldest);
      if (args.latest) params.set('latest', args.latest);

      const response = await fetchWithAuth(
        `https://slack.com/api/conversations.history?${params}`,
        accessToken
      );

      const data = await response.json();

      if (!data.ok) {
        return errorResult(`Slack API error: ${data.error}`);
      }

      const messages = (data.messages || []).map((msg: any) => ({
        ts: msg.ts,
        text: msg.text,
        user: msg.user,
        timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      }));

      return successResult({
        channel: args.channel,
        count: messages.length,
        messages,
      });
    } catch (error) {
      return errorResult(`Slack error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const slackSendTool = tool(
  'slack_send',
  'Send a message to a Slack channel.',
  {
    channel: z.string().describe('Channel ID to send message to'),
    text: z.string().describe('Message text to send'),
    threadTs: z.string().optional().describe('Thread timestamp to reply to'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Slack connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();

      const body: Record<string, string> = {
        channel: args.channel,
        text: args.text,
      };
      if (args.threadTs) {
        body.thread_ts = args.threadTs;
      }

      const response = await fetchWithAuth(
        'https://slack.com/api/chat.postMessage',
        accessToken,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        return errorResult(`Slack API error: ${data.error}`);
      }

      return successResult({
        success: true,
        channel: data.channel,
        ts: data.ts,
        message: data.message?.text,
      });
    } catch (error) {
      return errorResult(`Slack error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// ============================================================
// Notion Tools
// ============================================================

const notionSearchTool = tool(
  'notion_search',
  'Search for pages in Notion.',
  {
    query: z.string().describe('Search query'),
    filter: z.enum(['page', 'database']).optional().describe('Filter by object type'),
    pageSize: z.number().optional().default(10).describe('Number of results to return'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Notion connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();

      const body: Record<string, any> = {
        query: args.query,
        page_size: Math.min(args.pageSize || 10, 100),
      };
      if (args.filter) {
        body.filter = { property: 'object', value: args.filter };
      }

      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`Notion API error: ${error}`);
      }

      const data = await response.json();

      const results = (data.results || []).map((item: any) => {
        const title = item.properties?.title?.title?.[0]?.plain_text ||
                      item.properties?.Name?.title?.[0]?.plain_text ||
                      'Untitled';
        return {
          id: item.id,
          title,
          url: item.url,
          type: item.object,
          createdTime: item.created_time,
          lastEditedTime: item.last_edited_time,
        };
      });

      return successResult({
        query: args.query,
        count: results.length,
        results,
      });
    } catch (error) {
      return errorResult(`Notion error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const notionReadPageTool = tool(
  'notion_read_page',
  'Read contents of a Notion page.',
  {
    pageId: z.string().describe('The page ID to read'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('Notion connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      };

      // Get page metadata
      const pageResponse = await fetch(
        `https://api.notion.com/v1/pages/${args.pageId}`,
        { headers }
      );

      if (!pageResponse.ok) {
        const error = await pageResponse.text();
        return errorResult(`Failed to get page: ${error}`);
      }

      const page = await pageResponse.json();

      // Get page content (blocks)
      const blocksResponse = await fetch(
        `https://api.notion.com/v1/blocks/${args.pageId}/children?page_size=100`,
        { headers }
      );

      if (!blocksResponse.ok) {
        const error = await blocksResponse.text();
        return errorResult(`Failed to get page content: ${error}`);
      }

      const blocksData = await blocksResponse.json();

      // Extract text from blocks
      const content = (blocksData.results || [])
        .map((block: any) => {
          const type = block.type;
          const textContent = block[type]?.rich_text || block[type]?.text || [];
          return textContent.map((t: any) => t.plain_text).join('');
        })
        .filter(Boolean)
        .join('\n\n');

      // Get title
      const title = page.properties?.title?.title?.[0]?.plain_text ||
                    page.properties?.Name?.title?.[0]?.plain_text ||
                    'Untitled';

      return successResult({
        id: page.id,
        title,
        url: page.url,
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
        content: content.slice(0, 30000), // Limit content size
      });
    } catch (error) {
      return errorResult(`Notion error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// ============================================================
// GitHub Tools
// ============================================================

const githubListReposTool = tool(
  'github_list_repos',
  'List your GitHub repositories.',
  {
    type: z.enum(['all', 'owner', 'public', 'private', 'member']).optional().default('all').describe('Repository type'),
    sort: z.enum(['created', 'updated', 'pushed', 'full_name']).optional().default('updated').describe('Sort field'),
    perPage: z.number().optional().default(20).describe('Results per page'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('GitHub connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('type', args.type || 'all');
      params.set('sort', args.sort || 'updated');
      params.set('per_page', String(Math.min(args.perPage || 20, 100)));

      const response = await fetch(
        `https://api.github.com/user/repos?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`GitHub API error: ${error}`);
      }

      const repos = await response.json();

      const results = repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
      }));

      return successResult({
        count: results.length,
        repositories: results,
      });
    } catch (error) {
      return errorResult(`GitHub error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const githubGetRepoTool = tool(
  'github_get_repo',
  'Get details of a specific GitHub repository.',
  {
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('GitHub connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();

      const response = await fetch(
        `https://api.github.com/repos/${args.owner}/${args.repo}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`GitHub API error: ${error}`);
      }

      const repo = await response.json();

      return successResult({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        openIssuesCount: repo.open_issues_count,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        topics: repo.topics,
      });
    } catch (error) {
      return errorResult(`GitHub error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const githubListIssuesTool = tool(
  'github_list_issues',
  'List issues in a GitHub repository.',
  {
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
    state: z.enum(['open', 'closed', 'all']).optional().default('open').describe('Issue state'),
    perPage: z.number().optional().default(20).describe('Results per page'),
    labels: z.string().optional().describe('Comma-separated list of label names'),
  },
  async (args, extra) => {
    const ctx = extra as any as ConnectorContext;
    if (!ctx.getAccessToken) {
      return errorResult('GitHub connector not available');
    }

    try {
      const accessToken = await ctx.getAccessToken();
      const params = new URLSearchParams();
      params.set('state', args.state || 'open');
      params.set('per_page', String(Math.min(args.perPage || 20, 100)));
      if (args.labels) {
        params.set('labels', args.labels);
      }

      const response = await fetch(
        `https://api.github.com/repos/${args.owner}/${args.repo}/issues?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return errorResult(`GitHub API error: ${error}`);
      }

      const issues = await response.json();

      const results = issues.map((issue: any) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        body: issue.body?.slice(0, 500),
        user: issue.user?.login,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: issue.labels?.map((l: any) => l.name) || [],
      }));

      return successResult({
        count: results.length,
        issues: results,
      });
    } catch (error) {
      return errorResult(`GitHub error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// ============================================================
// MCP Server Factory
// ============================================================

/**
 * Map of provider to their tools
 * Using 'any' type for tools array to avoid complex generic issues with SDK tool definitions
 */
const PROVIDER_TOOLS: Record<OAuthProvider, any[]> = {
  google: [gmailListTool, gmailReadTool, driveListTool, driveReadTool, driveSearchTool],
  slack: [slackListChannelsTool, slackReadTool, slackSendTool],
  notion: [notionSearchTool, notionReadPageTool],
  github: [githubListReposTool, githubGetRepoTool, githubListIssuesTool],
};

/**
 * Create a connector MCP server with tools for the specified connections
 *
 * @param connections - Array of connection info with provider and token getter
 * @returns SDK MCP server instance
 */
export function createConnectorMcpServer(
  connections: Array<{
    connectionId: string;
    provider: OAuthProvider;
    getAccessToken: () => Promise<string>;
  }>
) {
  if (connections.length === 0) {
    return null;
  }

  const allTools: ReturnType<typeof tool>[] = [];
  const contexts = new Map<OAuthProvider, ConnectorContext>();

  // Group connections by provider
  for (const conn of connections) {
    if (!contexts.has(conn.provider)) {
      contexts.set(conn.provider, {
        connectionId: conn.connectionId,
        provider: conn.provider,
        getAccessToken: conn.getAccessToken,
      });
    }
  }

  // Add tools for each connected provider
  for (const [provider, context] of contexts.entries()) {
    const providerTools = PROVIDER_TOOLS[provider];
    if (providerTools) {
      // Create tools with bound context
      for (const t of providerTools) {
        // Create a wrapper tool that injects the context
        const wrappedTool = tool(
          t.name,
          t.description,
          (t as any).inputSchema?.shape || {},
          async (args: any, extra: any) => {
            return (t as any).handler(args, { ...extra, ...context });
          }
        );
        allTools.push(wrappedTool);
      }
    }
  }

  if (allTools.length === 0) {
    return null;
  }

  return createSdkMcpServer({
    name: 'connectors',
    version: '1.0.0',
    tools: allTools,
  });
}

/**
 * Get the list of tool names for a provider
 */
export function getConnectorToolNames(provider: OAuthProvider): string[] {
  const tools = PROVIDER_TOOLS[provider];
  return tools ? tools.map((t) => t.name) : [];
}

/**
 * Get all connector tool names
 */
export function getAllConnectorToolNames(): string[] {
  return Object.values(PROVIDER_TOOLS).flatMap((tools) =>
    tools.map((t) => t.name)
  );
}
