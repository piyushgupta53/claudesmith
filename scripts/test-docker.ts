/**
 * Test script for Docker sandbox functionality
 * Run with: npx tsx scripts/test-docker.ts
 */

import { dockerService } from '../lib/services/dockerService';
import {
  validateBashCommand,
  containsBlockedCommand,
  parseCommandTokens
} from '../lib/utils/commandValidator';
import {
  validateReadPath,
  validateWritePath,
  normalizePath
} from '../lib/utils/pathValidator';

async function testCommandValidator() {
  console.log('\n=== Testing Command Validator ===\n');

  const tests = [
    // Allowed commands
    { cmd: 'ls /project', expected: true, desc: 'List files' },
    { cmd: 'cat /project/README.md', expected: true, desc: 'Read file' },
    { cmd: 'grep "error" /project/logs.txt', expected: true, desc: 'Search file' },
    { cmd: 'find /project -name "*.ts"', expected: true, desc: 'Find files' },

    // Blocked commands
    { cmd: 'rm -rf /project', expected: false, desc: 'Delete files (blocked)' },
    { cmd: 'sudo apt install vim', expected: false, desc: 'System command (blocked)' },
    { cmd: 'npm install express', expected: false, desc: 'Package manager (blocked)' },

    // Dangerous patterns
    { cmd: 'echo $(ls)', expected: false, desc: 'Command substitution (blocked)' },
    { cmd: 'cat file.txt | grep pattern', expected: true, desc: 'Pipes (allowed)' },
    { cmd: 'ls > /scratch/output.txt', expected: true, desc: 'Redirect to scratch (allowed)' },
    { cmd: 'ls > /project/output.txt', expected: false, desc: 'Redirect to project (blocked)' }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = validateBashCommand(test.cmd);
    const success = result.valid === test.expected;

    if (success) {
      console.log(`✓ ${test.desc}`);
      passed++;
    } else {
      console.log(`✗ ${test.desc}`);
      console.log(`  Command: ${test.cmd}`);
      console.log(`  Expected: ${test.expected ? 'valid' : 'invalid'}`);
      console.log(`  Got: ${result.valid ? 'valid' : 'invalid'}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testPathValidator() {
  console.log('\n=== Testing Path Validator ===\n');

  const tests = [
    // Valid read paths
    { path: '/project/file.txt', op: 'read', expected: true, desc: 'Read from project' },
    { path: '/scratch/temp.txt', op: 'read', expected: true, desc: 'Read from scratch' },
    { path: '/skills/data-analysis/SKILL.md', op: 'read', expected: true, desc: 'Read skill' },

    // Invalid read paths
    { path: '/etc/passwd', op: 'read', expected: false, desc: 'Read system file (blocked)' },
    { path: '/var/log/system.log', op: 'read', expected: false, desc: 'Read system log (blocked)' },

    // Path traversal attempts
    { path: '/project/../etc/passwd', op: 'read', expected: false, desc: 'Path traversal (blocked)' },
    { path: '/scratch/../../etc/passwd', op: 'read', expected: false, desc: 'Path traversal 2 (blocked)' },

    // Valid write paths
    { path: '/scratch/output.txt', op: 'write', expected: true, desc: 'Write to scratch' },
    { path: '/scratch/data/results.json', op: 'write', expected: true, desc: 'Write to scratch subdir' },

    // Invalid write paths
    { path: '/project/file.txt', op: 'write', expected: false, desc: 'Write to project (blocked)' },
    { path: '/skills/custom.md', op: 'write', expected: false, desc: 'Write to skills (blocked)' },
    { path: '/etc/config', op: 'write', expected: false, desc: 'Write to system (blocked)' }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result =
      test.op === 'read'
        ? validateReadPath(test.path)
        : validateWritePath(test.path);
    const success = result.valid === test.expected;

    if (success) {
      console.log(`✓ ${test.desc}`);
      passed++;
    } else {
      console.log(`✗ ${test.desc}`);
      console.log(`  Path: ${test.path}`);
      console.log(`  Operation: ${test.op}`);
      console.log(`  Expected: ${test.expected ? 'valid' : 'invalid'}`);
      console.log(`  Got: ${result.valid ? 'valid' : 'invalid'}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testDockerService() {
  console.log('\n=== Testing Docker Service ===\n');

  try {
    // Check if Docker is available
    console.log('Checking Docker availability...');
    const dockerAvailable = await dockerService.isDockerAvailable();

    if (!dockerAvailable) {
      console.log('✗ Docker is not available');
      console.log('  Please start Docker Desktop and try again');
      return false;
    }

    console.log('✓ Docker is available');

    // Ensure Ubuntu image
    console.log('\nEnsuring Ubuntu image...');
    await dockerService.ensureImage();
    console.log('✓ Ubuntu image ready');

    // Create a test container
    console.log('\nCreating test container...');
    const testSessionId = 'test-' + Date.now();
    const mounts = [
      { source: process.cwd(), target: '/project', readonly: true },
      { source: process.cwd(), target: '/scratch', readonly: false }
    ];

    const containerId = await dockerService.createContainer(testSessionId, mounts);
    console.log(`✓ Container created: ${containerId.substring(0, 12)}`);

    // Test command execution
    console.log('\nTesting command execution...');
    const lsResult = await dockerService.executeCommand(containerId, 'ls /project', '/tmp', 5000);

    if (lsResult.exitCode === 0) {
      console.log('✓ Command execution successful');
      console.log(`  Files found: ${lsResult.stdout.split('\n').length} items`);
    } else {
      console.log('✗ Command execution failed');
      console.log(`  Exit code: ${lsResult.exitCode}`);
      console.log(`  Error: ${lsResult.stderr}`);
    }

    // Test file write
    console.log('\nTesting file write...');
    await dockerService.writeFile(containerId, '/scratch/test.txt', 'Hello from Docker!');
    console.log('✓ File written to /scratch/test.txt');

    // Test file read
    console.log('\nTesting file read...');
    const content = await dockerService.readFile(containerId, '/scratch/test.txt');

    if (content === 'Hello from Docker!') {
      console.log('✓ File read successful');
      console.log(`  Content: "${content}"`);
    } else {
      console.log('✗ File read failed');
      console.log(`  Expected: "Hello from Docker!"`);
      console.log(`  Got: "${content}"`);
    }

    // Test list files
    console.log('\nTesting list files...');
    const files = await dockerService.listFiles(containerId, '/scratch');
    console.log(`✓ Listed ${files.length} files in /scratch`);
    files.forEach(file => {
      console.log(`  - ${file.name} (${file.type}, ${file.size} bytes)`);
    });

    // Test container status
    console.log('\nTesting container status...');
    const status = await dockerService.getContainerStatus(containerId);
    console.log('✓ Container status retrieved');
    console.log(`  State: ${status.state}`);
    console.log(`  Uptime: ${status.uptime}ms`);

    // Cleanup
    console.log('\nCleaning up...');
    await dockerService.destroyContainer(containerId);
    console.log('✓ Container destroyed');

    console.log('\n✓ All Docker tests passed!');
    return true;
  } catch (error: any) {
    console.log(`\n✗ Docker test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('  Docker Sandbox Functionality Test');
  console.log('===========================================');

  const results = {
    commandValidator: await testCommandValidator(),
    pathValidator: await testPathValidator(),
    dockerService: await testDockerService()
  };

  console.log('\n===========================================');
  console.log('  Test Summary');
  console.log('===========================================\n');

  console.log(`Command Validator: ${results.commandValidator ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Path Validator: ${results.pathValidator ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Docker Service: ${results.dockerService ? '✓ PASS' : '✗ FAIL'}`);

  const allPassed = Object.values(results).every(r => r);

  console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
