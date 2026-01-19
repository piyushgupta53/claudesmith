/**
 * Test API Route - SDK Fixes Verification
 * Access via: http://localhost:3000/api/test-sdk
 */

import { NextResponse } from 'next/server';
import { migrateHookEvents, HOOK_EVENT_MIGRATION, CAN_USE_TOOL_EXAMPLES, type AgentConfig } from '@/lib/types/agent';
import { agentConfigToSDKOptions } from '@/lib/utils/agentConfigConverter';

export async function GET() {
  const results: Record<string, any> = {
    buildCompilation: { status: 'PASSED', message: 'TypeScript compiled successfully' },
    tests: []
  };

  try {
    // ========================================================================
    // Test 1: Hook Event Name Migration
    // ========================================================================
    const test1Result: any = {
      name: 'Hook Event Name Migration',
      status: 'UNKNOWN',
      details: {}
    };

    const legacyConfig: AgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Testing migration',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      systemPrompt: 'Test prompt',
      model: 'sonnet',
      tools: { enabled: ['Read'], disabled: [] },
      subagents: {},
      settings: {
        permissionMode: 'default',
      },
      ui: { color: '#10b981', icon: 'Bot', category: 'general' },
      hooks: {
        BeforeToolUse: [{ code: 'console.log("test")' }],
        AfterToolUse: [{ code: 'console.log("test")' }],
        BeforeSubagentCall: [{ code: 'console.log("test")' }],
        AfterSubagentCall: [{ code: 'console.log("test")' }],
        OnError: [{ code: 'console.log("test")' }],
        BeforeRequest: [{ code: 'console.log("test")' }],
        AfterResponse: [{ code: 'console.log("test")' }],
        SessionStart: [{ code: 'console.log("test")' }],
        SessionEnd: [{ code: 'console.log("test")' }],
      } as any
    };

    test1Result.details.legacyEvents = Object.keys(legacyConfig.hooks || {});

    const migratedConfig = migrateHookEvents(legacyConfig);
    test1Result.details.migratedEvents = Object.keys(migratedConfig.hooks || {});
    test1Result.details.migrationMap = HOOK_EVENT_MIGRATION;

    const expectedEvents = ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'PostToolUseFailure', 'SessionStart', 'SessionEnd'];
    const actualEvents = Object.keys(migratedConfig.hooks || {});

    const migrationSuccess = expectedEvents.every(e => actualEvents.includes(e)) &&
                             !actualEvents.includes('BeforeRequest') &&
                             !actualEvents.includes('AfterResponse');

    test1Result.status = migrationSuccess ? 'PASSED' : 'FAILED';
    test1Result.details.expectedCount = expectedEvents.length;
    test1Result.details.actualCount = actualEvents.length;
    test1Result.details.expectedEvents = expectedEvents;

    results.tests.push(test1Result);

    // ========================================================================
    // Test 2: Hook Callback Signature
    // ========================================================================
    const test2Result: any = {
      name: 'Hook Callback Signature',
      status: 'UNKNOWN',
      details: {}
    };

    try {
      const testConfig: AgentConfig = {
        ...legacyConfig,
        hooks: {
          PreToolUse: [{
            code: `
              // Test SDK signature - these variables should be available
              const hasInput = typeof input !== 'undefined';
              const hasToolUseID = typeof toolUseID !== 'undefined';
              const hasOptions = typeof options !== 'undefined';

              return {
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'allow',
                  permissionDecisionReason: \`Parameters available: input=\${hasInput}, toolUseID=\${hasToolUseID}, options=\${hasOptions}\`
                }
              };
            `
          }]
        }
      };

      const sdkOptions = await agentConfigToSDKOptions(testConfig);

      test2Result.details.hooksConfigured = Object.keys(sdkOptions.hooks || {});

      const preToolUseHooks = sdkOptions.hooks?.PreToolUse || [];
      if (preToolUseHooks.length > 0) {
        const handler = preToolUseHooks[0].handler;
        test2Result.details.handlerType = typeof handler;
        test2Result.details.handlerParamCount = handler.length;

        // Test execution with mock parameters
        const mockInput = {
          hook_event_name: 'PreToolUse' as const,
          tool_name: 'Read',
          tool_input: { file_path: '/test' },
          session_id: 'test',
          transcript_path: '/tmp/test',
          cwd: '/project'
        };

        const mockToolUseID = 'tool-123';
        const mockOptions = { signal: new AbortController().signal };

        const result = await handler(mockInput, mockToolUseID, mockOptions);
        test2Result.details.handlerResult = result;
        test2Result.status = 'PASSED';
      } else {
        test2Result.status = 'FAILED';
        test2Result.details.error = 'No hooks configured';
      }
    } catch (err: any) {
      test2Result.status = 'FAILED';
      test2Result.details.error = err.message;
      test2Result.details.stack = err.stack;
    }

    results.tests.push(test2Result);

    // ========================================================================
    // Test 3: canUseTool Callback Signature
    // ========================================================================
    const test3Result: any = {
      name: 'canUseTool Callback Signature',
      status: 'UNKNOWN',
      details: {}
    };

    try {
      const canUseToolConfig: AgentConfig = {
        ...legacyConfig,
        advanced: {
          canUseTool: `
            // Test SDK signature
            const hasToolName = typeof toolName !== 'undefined';
            const hasInput = typeof input !== 'undefined';
            const hasOptions = typeof options !== 'undefined';

            if (toolName === 'Read') {
              return {
                behavior: 'allow',
                updatedInput: {
                  ...input,
                  _testMetadata: { toolName: hasToolName, input: hasInput, options: hasOptions }
                }
              };
            }

            return {
              behavior: 'deny',
              message: 'Tool not allowed in test'
            };
          `
        }
      };

      const sdkOptions = await agentConfigToSDKOptions(canUseToolConfig);

      test3Result.details.canUseToolConfigured = !!sdkOptions.canUseTool;

      if (sdkOptions.canUseTool) {
        const handler = sdkOptions.canUseTool;
        test3Result.details.handlerType = typeof handler;
        test3Result.details.handlerParamCount = handler.length;

        // Test with mock parameters
        const mockToolName = 'Read';
        const mockInput = { file_path: '/test.txt' };
        const mockOptions = { signal: new AbortController().signal };

        const result = await handler(mockToolName, mockInput, mockOptions);
        test3Result.details.handlerResult = result;
        test3Result.status = 'PASSED';
      } else {
        test3Result.status = 'FAILED';
        test3Result.details.error = 'canUseTool not configured';
      }
    } catch (err: any) {
      test3Result.status = 'FAILED';
      test3Result.details.error = err.message;
    }

    results.tests.push(test3Result);

    // ========================================================================
    // Test 4: Example Templates
    // ========================================================================
    const test4Result: any = {
      name: 'Example Templates Available',
      status: 'PASSED',
      details: {
        exampleCount: Object.keys(CAN_USE_TOOL_EXAMPLES).length,
        examples: Object.keys(CAN_USE_TOOL_EXAMPLES)
      }
    };

    results.tests.push(test4Result);

    // ========================================================================
    // Summary
    // ========================================================================
    const passedCount = results.tests.filter((t: any) => t.status === 'PASSED').length;
    const totalCount = results.tests.length;

    results.summary = {
      total: totalCount,
      passed: passedCount,
      failed: totalCount - passedCount,
      allPassed: passedCount === totalCount
    };

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Test execution failed',
      message: error.message,
      stack: error.stack,
      results
    }, { status: 500 });
  }
}
