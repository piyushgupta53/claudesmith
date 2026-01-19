import { NextRequest, NextResponse } from 'next/server';
import { dockerService } from '@/lib/services/dockerService';

/**
 * GET /api/docker/status
 * Check Docker daemon status and image availability
 */
export async function GET(request: NextRequest) {
  const status: {
    available: boolean;
    error?: string;
    imageReady: boolean;
    runningContainers: number;
  } = {
    available: false,
    imageReady: false,
    runningContainers: 0,
  };

  try {
    // Check if Docker daemon is running
    const available = await dockerService.isDockerAvailable();
    status.available = available;

    if (!available) {
      status.error = 'Docker daemon is not running. Please start Docker Desktop.';
      return NextResponse.json(status);
    }

    // Check if ubuntu image is available
    const Docker = (await import('dockerode')).default;
    const docker = new Docker();

    const images = await docker.listImages({
      filters: { reference: ['ubuntu:24.04'] }
    });
    status.imageReady = images.length > 0;

    // Count running claude-agent containers
    const containers = await docker.listContainers({
      filters: { name: ['claude-agent-'] }
    });
    status.runningContainers = containers.length;

    return NextResponse.json(status);
  } catch (error: any) {
    status.error = error.message;
    return NextResponse.json(status, { status: 500 });
  }
}

/**
 * POST /api/docker/status
 * Trigger image pull or cleanup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'pull-image') {
      // Pull the Ubuntu image
      await dockerService.ensureImage();
      return NextResponse.json({ success: true, message: 'Image pulled successfully' });
    }

    if (action === 'cleanup') {
      // Cleanup all claude-agent containers
      await dockerService.cleanupAllContainers();
      return NextResponse.json({ success: true, message: 'Containers cleaned up' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
