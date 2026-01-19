/**
 * OAuth Provider Configurations
 * Contains OAuth endpoints, scopes, and tool definitions for each provider
 */

import type { OAuthProvider, OAuthProviderConfig } from '../types/connector';

/**
 * Google OAuth configuration (Gmail + Drive)
 */
export const GOOGLE_CONFIG: OAuthProviderConfig = {
  provider: 'google',
  name: 'Google',
  description: 'Access Gmail and Google Drive',
  icon: 'Mail', // Lucide icon name
  color: '#EA4335',

  // OAuth endpoints
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',

  // Available scopes
  scopes: [
    {
      value: 'https://www.googleapis.com/auth/gmail.readonly',
      name: 'Gmail Read',
      description: 'Read your email messages',
      required: true,
    },
    {
      value: 'https://www.googleapis.com/auth/drive.readonly',
      name: 'Drive Read',
      description: 'View files in your Google Drive',
      required: true,
    },
    {
      value: 'https://www.googleapis.com/auth/userinfo.email',
      name: 'Email Address',
      description: 'View your email address',
      required: true,
    },
    {
      value: 'https://www.googleapis.com/auth/userinfo.profile',
      name: 'Profile',
      description: 'View your basic profile info',
      required: true,
    },
  ],

  // Default scopes (read-only as per plan)
  defaultScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],

  // Tools provided
  tools: [
    {
      name: 'gmail_list',
      description: 'List emails from Gmail inbox',
      requiredScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      access: 'read',
    },
    {
      name: 'gmail_read',
      description: 'Read a specific email message',
      requiredScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      access: 'read',
    },
    {
      name: 'drive_list',
      description: 'List files in Google Drive',
      requiredScopes: ['https://www.googleapis.com/auth/drive.readonly'],
      access: 'read',
    },
    {
      name: 'drive_read',
      description: 'Read contents of a file from Google Drive',
      requiredScopes: ['https://www.googleapis.com/auth/drive.readonly'],
      access: 'read',
    },
    {
      name: 'drive_search',
      description: 'Search for files in Google Drive',
      requiredScopes: ['https://www.googleapis.com/auth/drive.readonly'],
      access: 'read',
    },
  ],

  supportsPKCE: true,
  responseType: 'code',
  additionalAuthParams: {
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Always show consent screen for refresh token
  },
};

/**
 * Slack OAuth configuration
 */
export const SLACK_CONFIG: OAuthProviderConfig = {
  provider: 'slack',
  name: 'Slack',
  description: 'Read and send messages in Slack',
  icon: 'MessageSquare', // Lucide icon name
  color: '#4A154B',

  // OAuth endpoints
  authorizationUrl: 'https://slack.com/oauth/v2/authorize',
  tokenUrl: 'https://slack.com/api/oauth.v2.access',
  revokeUrl: 'https://slack.com/api/auth.revoke',
  userInfoUrl: 'https://slack.com/api/users.identity',

  // Available scopes
  scopes: [
    {
      value: 'channels:read',
      name: 'Read Channels',
      description: 'View channel list and information',
      required: true,
    },
    {
      value: 'channels:history',
      name: 'Channel History',
      description: 'Read messages in public channels',
      required: true,
    },
    {
      value: 'chat:write',
      name: 'Send Messages',
      description: 'Send messages to channels',
      required: false,
    },
    {
      value: 'users:read',
      name: 'Read Users',
      description: 'View user profiles',
      required: true,
    },
    {
      value: 'identity.basic',
      name: 'Basic Identity',
      description: 'View your basic profile info',
      required: true,
    },
  ],

  // Default scopes
  defaultScopes: [
    'channels:read',
    'channels:history',
    'chat:write',
    'users:read',
  ],

  // Tools provided
  tools: [
    {
      name: 'slack_list_channels',
      description: 'List channels in the workspace',
      requiredScopes: ['channels:read'],
      access: 'read',
    },
    {
      name: 'slack_read',
      description: 'Read messages from a channel',
      requiredScopes: ['channels:history'],
      access: 'read',
    },
    {
      name: 'slack_send',
      description: 'Send a message to a channel',
      requiredScopes: ['chat:write'],
      access: 'write',
    },
  ],

  supportsPKCE: false,
  responseType: 'code',
};

/**
 * Notion OAuth configuration
 */
export const NOTION_CONFIG: OAuthProviderConfig = {
  provider: 'notion',
  name: 'Notion',
  description: 'Access Notion pages and databases',
  icon: 'FileText', // Lucide icon name
  color: '#000000',

  // OAuth endpoints
  authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
  // Notion doesn't have a revoke endpoint, tokens are revoked via integration settings

  // Notion uses fixed scopes, not user-selectable
  scopes: [
    {
      value: 'read_content',
      name: 'Read Content',
      description: 'Read pages and databases shared with the integration',
      required: true,
    },
  ],

  // Default scopes (Notion integration access is determined during setup)
  defaultScopes: [],

  // Tools provided
  tools: [
    {
      name: 'notion_search',
      description: 'Search for pages in Notion',
      requiredScopes: [],
      access: 'read',
    },
    {
      name: 'notion_read_page',
      description: 'Read contents of a Notion page',
      requiredScopes: [],
      access: 'read',
    },
  ],

  supportsPKCE: false,
  responseType: 'code',
  additionalAuthParams: {
    owner: 'user', // Request user-level access
  },
};

/**
 * GitHub OAuth configuration
 */
export const GITHUB_CONFIG: OAuthProviderConfig = {
  provider: 'github',
  name: 'GitHub',
  description: 'Access repositories and issues',
  icon: 'Github', // Lucide icon name
  color: '#24292E',

  // OAuth endpoints
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  revokeUrl: 'https://api.github.com/applications/{client_id}/token',
  userInfoUrl: 'https://api.github.com/user',

  // Available scopes
  scopes: [
    {
      value: 'repo',
      name: 'Repository Access',
      description: 'Read access to repositories (includes private)',
      required: false,
    },
    {
      value: 'public_repo',
      name: 'Public Repositories',
      description: 'Read access to public repositories only',
      required: true,
    },
    {
      value: 'read:user',
      name: 'Read User',
      description: 'View your profile information',
      required: true,
    },
    {
      value: 'read:org',
      name: 'Read Organization',
      description: 'View organization membership',
      required: false,
    },
  ],

  // Default scopes (read-only)
  defaultScopes: ['public_repo', 'read:user'],

  // Tools provided
  tools: [
    {
      name: 'github_list_repos',
      description: 'List your GitHub repositories',
      requiredScopes: ['public_repo'],
      access: 'read',
    },
    {
      name: 'github_get_repo',
      description: 'Get details of a specific repository',
      requiredScopes: ['public_repo'],
      access: 'read',
    },
    {
      name: 'github_list_issues',
      description: 'List issues in a repository',
      requiredScopes: ['public_repo'],
      access: 'read',
    },
  ],

  supportsPKCE: false,
  responseType: 'code',
};

/**
 * All provider configurations
 */
export const PROVIDER_CONFIGS: Record<OAuthProvider, OAuthProviderConfig> = {
  google: GOOGLE_CONFIG,
  slack: SLACK_CONFIG,
  notion: NOTION_CONFIG,
  github: GITHUB_CONFIG,
};

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: OAuthProvider): OAuthProviderConfig {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return config;
}

/**
 * Get all available providers
 */
export function getAllProviders(): OAuthProvider[] {
  return Object.keys(PROVIDER_CONFIGS) as OAuthProvider[];
}

/**
 * Check if a provider supports a specific tool
 */
export function providerHasTool(provider: OAuthProvider, toolName: string): boolean {
  const config = getProviderConfig(provider);
  return config.tools.some(tool => tool.name === toolName);
}

/**
 * Get tools for a provider based on granted scopes
 */
export function getAvailableTools(provider: OAuthProvider, grantedScopes: string[]): string[] {
  const config = getProviderConfig(provider);
  const grantedSet = new Set(grantedScopes);

  return config.tools
    .filter(tool => {
      // If no required scopes, tool is always available
      if (tool.requiredScopes.length === 0) return true;
      // Check if all required scopes are granted
      return tool.requiredScopes.every(scope => grantedSet.has(scope));
    })
    .map(tool => tool.name);
}

/**
 * Get environment variable names for a provider
 */
export function getProviderEnvVars(provider: OAuthProvider): { clientId: string; clientSecret: string } {
  const envMap: Record<OAuthProvider, { clientId: string; clientSecret: string }> = {
    google: {
      clientId: 'GOOGLE_CLIENT_ID',
      clientSecret: 'GOOGLE_CLIENT_SECRET',
    },
    slack: {
      clientId: 'SLACK_CLIENT_ID',
      clientSecret: 'SLACK_CLIENT_SECRET',
    },
    notion: {
      clientId: 'NOTION_CLIENT_ID',
      clientSecret: 'NOTION_CLIENT_SECRET',
    },
    github: {
      clientId: 'GITHUB_CLIENT_ID',
      clientSecret: 'GITHUB_CLIENT_SECRET',
    },
  };

  return envMap[provider];
}

/**
 * Check if provider credentials are configured
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const envVars = getProviderEnvVars(provider);
  return !!(process.env[envVars.clientId] && process.env[envVars.clientSecret]);
}

/**
 * Get provider credentials from environment
 */
export function getProviderCredentials(provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const envVars = getProviderEnvVars(provider);
  const clientId = process.env[envVars.clientId];
  const clientSecret = process.env[envVars.clientSecret];

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

/**
 * Build the OAuth redirect URI for a provider
 */
export function getRedirectUri(provider: OAuthProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/connectors/${provider}/callback`;
}

/**
 * Get the list of tool names for a provider (client-safe)
 */
export function getConnectorToolNames(provider: OAuthProvider): string[] {
  const config = PROVIDER_CONFIGS[provider];
  return config ? config.tools.map((t) => t.name) : [];
}

/**
 * Get all connector tool names (client-safe)
 */
export function getAllConnectorToolNames(): string[] {
  return Object.values(PROVIDER_CONFIGS).flatMap((config) =>
    config.tools.map((t) => t.name)
  );
}
