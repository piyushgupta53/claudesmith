/**
 * Docker Service
 *
 * Manages Docker containers for sandboxed agent execution
 * Handles container lifecycle, command execution, and file operations
 */

import Docker from 'dockerode';
import { Readable } from 'stream';
import crypto from 'crypto';
import {
  MountConfig,
  CommandResult,
  ContainerStatus,
  FileInfo
} from '../types/container';

/**
 * Global container map that persists across module reloads in Next.js
 * This is necessary because Next.js may recreate module instances in development
 * and the containers Map would be lost
 */
declare global {
  var _dockerContainers: Map<string, string> | undefined;
}

// Initialize or reuse global containers map
if (!global._dockerContainers) {
  global._dockerContainers = new Map();
}

/**
 * Docker Service singleton instance
 */
class DockerService {
  private docker: Docker;
  private containers: Map<string, string>; // sessionId -> containerId

  constructor() {
    this.docker = new Docker();
    // Use global containers map to persist across module reloads
    this.containers = global._dockerContainers!;
  }

  /**
   * Create a new isolated container for a session
   * Uses claudesmith:latest image with pre-installed tools for fast startup
   * @param sessionId - Unique session identifier
   * @param mounts - Volume mounts configuration
   */
  async createContainer(
    sessionId: string,
    mounts: MountConfig[]
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Check if Docker is running
      console.log('[DockerService] Checking Docker daemon...');
      await this.docker.ping();
      console.log('[DockerService] Docker daemon is running');
    } catch (error) {
      throw new Error(
        'Docker daemon is not running. Please start Docker Desktop and try again.'
      );
    }

    try {
      // Check if a container for this session already exists
      const existingContainerId = this.containers.get(sessionId);
      if (existingContainerId) {
        console.log('[DockerService] Container already exists for session, reusing:', existingContainerId);
        try {
          const existing = this.docker.getContainer(existingContainerId);
          const info = await existing.inspect();
          if (info.State.Running) {
            return existingContainerId;
          }
          // Container exists but not running, remove it
          console.log('[DockerService] Existing container not running, removing...');
          await existing.remove({ force: true });
        } catch (e) {
          // Container doesn't exist, continue with creation
          console.log('[DockerService] Existing container not found, creating new one');
        }
        this.containers.delete(sessionId);
      }

      // Check for orphaned containers with same name
      const containerName = `claude-agent-${sessionId}`;
      try {
        const existingByName = this.docker.getContainer(containerName);
        const info = await existingByName.inspect();
        console.log('[DockerService] Found orphaned container with same name, removing...');
        await existingByName.remove({ force: true });
      } catch (e) {
        // No orphaned container, good
      }

      // Convert mounts to Docker bind format
      console.log('[DockerService] Configuring mounts:', mounts.map(m => `${m.target} (${m.readonly ? 'ro' : 'rw'})`));
      const binds = mounts.map((mount) => {
        const mode = mount.readonly ? 'ro' : 'rw';
        return `${mount.source}:${mount.target}:${mode}`;
      });

      // Create container with resource limits
      console.log('[DockerService] Creating container...');
      const container = await this.docker.createContainer({
        Image: 'claudesmith:latest',
        name: containerName,
        Tty: true,
        OpenStdin: true,
        WorkingDir: '/scratch',
        Cmd: ['/bin/bash'],
        HostConfig: {
          Binds: binds,
          Memory: 4 * 1024 * 1024 * 1024, // 4GB RAM
          MemorySwap: 4 * 1024 * 1024 * 1024, // Disable swap
          NanoCpus: 2 * 1000000000, // 2 CPU cores
          // DiskQuota is not supported on all systems, remove it
          NetworkMode: 'bridge', // Restricted network
          ReadonlyRootfs: false,
          AutoRemove: false // Manual cleanup for debugging
        }
      });

      // Start container
      console.log('[DockerService] Starting container...');
      await container.start();

      const containerId = container.id;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[DockerService] Container started in ${elapsed}s: ${containerId.substring(0, 12)}`);

      // Store container ID mapping
      this.containers.set(sessionId, containerId);

      // Tools are pre-installed in claudesmith:latest image
      // No runtime installation needed - container is ready to use

      return containerId;
    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[DockerService] Container creation failed after ${elapsed}s:`, error.message);
      throw new Error(`Failed to create container: ${error.message}`);
    }
  }

  /**
   * Execute a command in the container
   */
  async executeCommand(
    containerId: string,
    command: string,
    cwd: string = '/scratch',
    timeout: number = 30000
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      const container = this.docker.getContainer(containerId);

      // Create exec instance
      const exec = await container.exec({
        Cmd: ['/bin/bash', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: cwd,
        Tty: false
      });

      // Start exec with timeout
      const stream = await Promise.race([
        exec.start({ Detach: false, Tty: false }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Command timed out')), timeout)
        )
      ]);

      // Collect output
      let stdout = '';
      let stderr = '';
      let currentStream: 'stdout' | 'stderr' = 'stdout';

      if (stream && typeof stream === 'object' && 'on' in stream) {
        await new Promise<void>((resolve, reject) => {
          (stream as any).on('data', (chunk: Buffer) => {
            const data = chunk.toString('utf8');

            // Docker multiplexes stdout/stderr
            // First byte indicates stream type (1=stdout, 2=stderr)
            if (chunk[0] === 1) {
              stdout += data.slice(8); // Skip 8-byte header
            } else if (chunk[0] === 2) {
              stderr += data.slice(8); // Skip 8-byte header
            } else {
              // Fallback: add to current stream
              if (currentStream === 'stdout') {
                stdout += data;
              } else {
                stderr += data;
              }
            }
          });

          (stream as any).on('end', resolve);
          (stream as any).on('error', reject);
        });
      }

      // Get exit code
      const inspectData = await exec.inspect();
      const exitCode = inspectData.ExitCode || 0;

      const executionTime = Date.now() - startTime;

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (error.message === 'Command timed out') {
        return {
          stdout: '',
          stderr: `Command timed out after ${timeout}ms`,
          exitCode: 124, // Timeout exit code
          executionTime
        };
      }

      throw new Error(`Failed to execute command: ${error.message}`);
    }
  }

  /**
   * Read file from container
   */
  async readFile(containerId: string, filePath: string): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);

      // Use cat command to read file
      const exec = await container.exec({
        Cmd: ['/bin/cat', filePath],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ Detach: false, Tty: false });

      // Collect output
      let content = '';
      let stderr = '';

      if (stream && typeof stream === 'object' && 'on' in stream) {
        await new Promise<void>((resolve, reject) => {
          (stream as any).on('data', (chunk: Buffer) => {
            const data = chunk.toString('utf8');

            if (chunk[0] === 1) {
              content += data.slice(8); // stdout
            } else if (chunk[0] === 2) {
              stderr += data.slice(8); // stderr
            } else {
              content += data;
            }
          });

          (stream as any).on('end', resolve);
          (stream as any).on('error', reject);
        });
      }

      // Check for errors
      const inspectData = await exec.inspect();
      if (inspectData.ExitCode !== 0) {
        throw new Error(stderr || 'Failed to read file');
      }

      return content;
    } catch (error: any) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write file to container
   */
  async writeFile(
    containerId: string,
    filePath: string,
    content: string
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      // Create directory if needed
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dir) {
        await this.executeCommand(
          containerId,
          `mkdir -p "${dir}"`,
          '/tmp',
          5000
        );
      }

      // Write file using heredoc with unique delimiter to prevent injection
      // SECURITY: Generate a random delimiter to prevent content from breaking out of heredoc
      // If content contains the delimiter string, it would terminate the heredoc early
      // and allow arbitrary command injection bypassing all validation
      const delimiter = `EOF_${crypto.randomUUID().replace(/-/g, '')}`;
      const writeCmd = `cat > "${filePath}" << '${delimiter}'\n${content}\n${delimiter}`;

      const result = await this.executeCommand(
        containerId,
        writeCmd,
        '/tmp',
        10000
      );

      if (result.exitCode !== 0) {
        throw new Error(result.stderr || 'Failed to write file');
      }
    } catch (error: any) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * List files in directory
   */
  async listFiles(containerId: string, dirPath: string): Promise<FileInfo[]> {
    try {
      // Use ls with JSON-like output
      const result = await this.executeCommand(
        containerId,
        `find "${dirPath}" -maxdepth 1 -exec stat -c '{"path":"%n","size":%s,"modified":"%y","type":"%F"}' {} \\; 2>/dev/null || echo ''`,
        '/tmp',
        10000
      );

      if (result.exitCode !== 0 || !result.stdout) {
        return [];
      }

      // Parse output
      const files: FileInfo[] = [];
      const lines = result.stdout.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const name = data.path.split('/').pop() || '';

          // Skip . and ..
          if (name === '.' || name === '..') {
            continue;
          }

          files.push({
            path: data.path,
            name,
            type: data.type === 'directory' ? 'directory' : 'file',
            size: parseInt(data.size, 10) || 0,
            modified: data.modified
          });
        } catch (parseError) {
          // Skip invalid lines
          continue;
        }
      }

      return files;
    } catch (error: any) {
      throw new Error(`Failed to list files in ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(containerId: string): Promise<ContainerStatus> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      const stats = await container.stats({ stream: false });

      // Calculate uptime
      const startedAt = new Date(info.State.StartedAt).getTime();
      const uptime = Date.now() - startedAt;

      // Extract resource usage
      const cpuUsage = this.calculateCpuPercent(stats);
      const memoryUsage = stats.memory_stats.usage || 0;
      const diskUsage = 0; // Docker doesn't provide easy disk usage in stats

      return {
        id: containerId,
        state: this.mapContainerState(info.State.Status),
        uptime,
        resourceUsage: {
          cpu: cpuUsage,
          memory: memoryUsage,
          disk: diskUsage
        }
      };
    } catch (error: any) {
      throw new Error(
        `Failed to get container status: ${error.message}`
      );
    }
  }

  /**
   * Calculate CPU percentage from stats
   */
  private calculateCpuPercent(stats: any): number {
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

    if (systemDelta > 0 && cpuDelta > 0) {
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      return (cpuDelta / systemDelta) * cpuCount * 100.0;
    }

    return 0;
  }

  /**
   * Map Docker state to our state enum
   */
  private mapContainerState(
    dockerState: string
  ): ContainerStatus['state'] {
    switch (dockerState) {
      case 'created':
        return 'created';
      case 'running':
        return 'running';
      case 'paused':
      case 'restarting':
      case 'removing':
      case 'exited':
      case 'dead':
        return 'stopped';
      default:
        return 'error';
    }
  }

  /**
   * Destroy container and cleanup
   */
  async destroyContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      // Stop container if running
      try {
        await container.stop({ t: 5 }); // 5 second timeout
      } catch (error) {
        // Container may already be stopped
      }

      // Remove container
      await container.remove({ force: true });

      // Remove from mapping
      for (const [sessionId, id] of this.containers.entries()) {
        if (id === containerId) {
          this.containers.delete(sessionId);
          break;
        }
      }
    } catch (error: any) {
      throw new Error(
        `Failed to destroy container: ${error.message}`
      );
    }
  }

  /**
   * Get container ID for session
   */
  getContainerIdForSession(sessionId: string): string | undefined {
    return this.containers.get(sessionId);
  }

  /**
   * Destroy container for a session by session ID
   * @param sessionId - Session identifier to find and destroy container for
   * @returns true if container was found and destroyed, false if no container existed
   */
  async destroyContainerBySession(sessionId: string): Promise<boolean> {
    const containerId = this.containers.get(sessionId);
    if (!containerId) {
      console.log(`[DockerService] No container found for session ${sessionId}`);
      return false;
    }

    console.log(`[DockerService] Destroying container for session ${sessionId}: ${containerId.substring(0, 12)}`);
    await this.destroyContainer(containerId);
    return true;
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if claudesmith:latest image exists
   * The image must be pre-built with: npm run build:docker
   */
  async ensureImage(): Promise<void> {
    try {
      // Check if claudesmith:latest image exists
      console.log('[DockerService] Checking for claudesmith:latest image...');
      const images = await this.docker.listImages({
        filters: { reference: ['claudesmith:latest'] }
      });

      if (images.length > 0) {
        console.log('[DockerService] Image found: claudesmith:latest');
        return;
      }

      // Image not found - user needs to build it
      throw new Error(
        'claudesmith:latest image not found. Please run: npm run build:docker'
      );
    } catch (error: any) {
      if (error.message.includes('claudesmith:latest image not found')) {
        throw error;
      }
      throw new Error(`Failed to check for Docker image: ${error.message}`);
    }
  }

  /**
   * Cleanup all containers (for testing/debugging)
   */
  async cleanupAllContainers(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { name: ['claude-agent-'] }
      });

      for (const containerInfo of containers) {
        try {
          const container = this.docker.getContainer(containerInfo.Id);
          await container.stop({ t: 5 });
          await container.remove({ force: true });
        } catch (error) {
          // Ignore errors for individual containers
          console.warn(`Failed to cleanup container ${containerInfo.Id}`);
        }
      }

      this.containers.clear();
    } catch (error: any) {
      console.error('Failed to cleanup containers:', error.message);
    }
  }
}

// Export singleton instance
export const dockerService = new DockerService();
export default dockerService;
