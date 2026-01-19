/**
 * OAuth Connector Types
 * Type definitions for OAuth-based service connectors (Gmail, Drive, Slack, Notion, GitHub)
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'google' | 'slack' | 'notion' | 'github';

/**
 * Connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error';

/**
 * OAuth tokens
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp in milliseconds
  tokenType: string;
  scope?: string;
}

/**
 * OAuth connection metadata
 */
export interface OAuthConnection {
  id: string;
  provider: OAuthProvider;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;

  // User info from the provider (fetched after OAuth)
  userInfo?: {
    email?: string;
    name?: string;
    avatar?: string;
    id?: string;
  };

  // Scopes that were granted
  grantedScopes: string[];

  // Error message if status is 'error'
  errorMessage?: string;
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  provider: OAuthProvider;
  name: string;
  description: string;
  icon: string;
  color: string;

  // OAuth endpoints
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  userInfoUrl?: string;

  // Available scopes
  scopes: OAuthScope[];

  // Default scopes to request
  defaultScopes: string[];

  // Tools provided by this connector
  tools: ConnectorTool[];

  // PKCE support
  supportsPKCE: boolean;

  // Response type for authorization
  responseType: 'code' | 'token';

  // Additional authorization parameters
  additionalAuthParams?: Record<string, string>;
}

/**
 * OAuth scope definition
 */
export interface OAuthScope {
  value: string;
  name: string;
  description: string;
  required?: boolean;
}

/**
 * Connector tool definition
 */
export interface ConnectorTool {
  name: string;
  description: string;
  requiredScopes: string[];
  access: 'read' | 'write' | 'read-write';
}

/**
 * OAuth state parameter (stored during OAuth flow)
 */
export interface OAuthState {
  provider: OAuthProvider;
  redirectUri: string;
  codeVerifier?: string; // For PKCE
  scopes: string[];
  timestamp: number;
  nonce: string;
}

/**
 * OAuth callback data
 */
export interface OAuthCallbackData {
  code: string;
  state: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Token exchange request
 */
export interface TokenExchangeRequest {
  provider: OAuthProvider;
  code: string;
  codeVerifier?: string;
  redirectUri: string;
}

/**
 * Token refresh request
 */
export interface TokenRefreshRequest {
  provider: OAuthProvider;
  refreshToken: string;
}

/**
 * Connector store state
 */
export interface ConnectorState {
  connections: Map<string, OAuthConnection>;
  encryptedTokens: Map<string, string>; // connectionId -> encrypted token string
  pendingStates: Map<string, OAuthState>; // state nonce -> OAuth state
}

/**
 * Connector store actions
 */
export interface ConnectorActions {
  // Connection CRUD
  addConnection: (connection: Omit<OAuthConnection, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateConnection: (id: string, updates: Partial<OAuthConnection>) => void;
  deleteConnection: (id: string) => void;
  getConnection: (id: string) => OAuthConnection | undefined;
  getConnectionsByProvider: (provider: OAuthProvider) => OAuthConnection[];
  listConnections: () => OAuthConnection[];

  // Token management
  setEncryptedTokens: (connectionId: string, encryptedTokens: string) => void;
  getEncryptedTokens: (connectionId: string) => string | undefined;
  removeEncryptedTokens: (connectionId: string) => void;

  // OAuth flow state management
  setPendingState: (nonce: string, state: OAuthState) => void;
  getPendingState: (nonce: string) => OAuthState | undefined;
  removePendingState: (nonce: string) => void;
  cleanupExpiredStates: () => void;
}

/**
 * Full connector store type
 */
export type ConnectorStore = ConnectorState & ConnectorActions;

/**
 * Encrypted token payload structure
 */
export interface EncryptedTokenPayload {
  version: number;
  iv: string;
  ciphertext: string;
  authTag: string;
}

/**
 * API response types
 */
export interface ConnectorListResponse {
  connections: OAuthConnection[];
}

export interface ConnectorCreateResponse {
  connection: OAuthConnection;
}

export interface ConnectorAuthorizeResponse {
  authorizationUrl: string;
  state: string;
}

export interface ConnectorCallbackResponse {
  success: boolean;
  connection?: OAuthConnection;
  error?: string;
}

export interface ConnectorRefreshResponse {
  success: boolean;
  expiresAt?: number;
  error?: string;
}

export interface ConnectorRevokeResponse {
  success: boolean;
  error?: string;
}

/**
 * Tool result types for connector tools
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  labelIds: string[];
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  parents?: string[];
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  topic?: string;
  purpose?: string;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  channel: string;
  timestamp: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  parentType: 'database' | 'page' | 'workspace';
  parentId?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body?: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}
