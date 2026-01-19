/**
 * Container Types
 *
 * TypeScript interfaces for Docker container management
 * Used by DockerService to handle container lifecycle, command execution, and file operations
 */

/**
 * Mount configuration for container volumes
 */
export interface MountConfig {
  /** Source path on host machine */
  source: string;
  /** Target path inside container */
  target: string;
  /** Whether mount is read-only */
  readonly: boolean;
}

/**
 * Result from executing a command in container
 */
export interface CommandResult {
  /** Standard output from command */
  stdout: string;
  /** Standard error from command */
  stderr: string;
  /** Exit code (0 = success, non-zero = error) */
  exitCode: number;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Container status information
 */
export interface ContainerStatus {
  /** Container ID */
  id: string;
  /** Current state of container */
  state: 'created' | 'running' | 'stopped' | 'error';
  /** Uptime in milliseconds */
  uptime: number;
  /** Resource usage metrics */
  resourceUsage: {
    /** CPU usage percentage (0-100) */
    cpu: number;
    /** Memory usage in bytes */
    memory: number;
    /** Disk usage in bytes */
    disk: number;
  };
}

/**
 * File or directory information
 */
export interface FileInfo {
  /** Full path to file/directory */
  path: string;
  /** File/directory name */
  name: string;
  /** Type of item */
  type: 'file' | 'directory';
  /** Size in bytes (0 for directories) */
  size: number;
  /** Last modified timestamp (ISO 8601) */
  modified: string;
}

/**
 * Validation result for commands or paths
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Sanitized version of input (if applicable) */
  sanitized?: string;
}
