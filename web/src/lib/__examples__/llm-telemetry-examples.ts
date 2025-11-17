/**
 * LLM Telemetry Library - Usage Examples
 *
 * Examples showing how to use the universal LLM telemetry library
 * across different environments and use cases.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { wrapLLMCall, getCostReport } from '@/lib/llm-telemetry';

// =============================================================================
// EXAMPLE 1: Next.js API Route (Track App AI Coaching)
// =============================================================================

/**
 * Example: Using telemetry wrapper in a Next.js API route
 *
 * This shows how to wrap an Anthropic API call in the Track App's
 * AI coaching generation endpoint.
 */
export async function example1_NextJsApiRoute() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sessionId = 'abc123';
  const prompt = 'Generate coaching feedback for this session...';

  // Wrap the LLM call with telemetry
  const result = await wrapLLMCall(
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      prompt: prompt,
      metadata: {
        project: 'track-app',
        feature: 'ai-coaching',
        sessionId: sessionId,
      },
    },
    async () => {
      // Make the actual API call
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text from response
      const output = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      // Return output and usage for telemetry
      return {
        output: output,
        usage: message.usage,
      };
    }
  );

  // Use the result
  console.log('Coaching generated:', result.output);
  console.log('Cost:', `$${result.cost.toFixed(4)}`);
  console.log('Tokens:', `${result.tokensIn} in, ${result.tokensOut} out`);
  console.log('Latency:', `${result.latencyMs}ms`);

  return result;
}

// =============================================================================
// EXAMPLE 2: Standalone Node.js Script
// =============================================================================

/**
 * Example: Using telemetry in a standalone Node.js script
 *
 * This shows how to use the library outside of Next.js, such as in
 * batch processing scripts, cron jobs, or data analysis tools.
 */
export async function example2_StandaloneScript() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Process multiple items with telemetry
  const items = ['Item 1', 'Item 2', 'Item 3'];
  const results = [];

  for (const item of items) {
    const prompt = `Analyze this item: ${item}`;

    const result = await wrapLLMCall(
      {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: prompt,
        metadata: {
          project: 'content-ops-copilot',
          feature: 'content-analysis',
          itemId: item,
        },
      },
      async () => {
        // Make OpenAI API call
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        });

        const output = completion.choices[0]?.message?.content || '';

        // Return output and usage
        return {
          output: output,
          usage: {
            prompt_tokens: completion.usage?.prompt_tokens || 0,
            completion_tokens: completion.usage?.completion_tokens || 0,
          },
        };
      }
    );

    results.push(result);
  }

  // Calculate total cost
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
  console.log(`Processed ${results.length} items for $${totalCost.toFixed(4)}`);

  return results;
}

// =============================================================================
// EXAMPLE 3: n8n Code Node
// =============================================================================

/**
 * Example: Using telemetry in n8n Code node
 *
 * This shows how to use the library in n8n workflows.
 * Copy this into an n8n "Code" node (Run Once for All Items mode).
 */
export const example3_N8nCodeNode = `
// n8n Code Node - Copy this into your n8n workflow
// Mode: Run Once for All Items

import Anthropic from '@anthropic-ai/sdk';
import { wrapLLMCall } from './llm-telemetry'; // Adjust path as needed

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: $env.ANTHROPIC_API_KEY
});

// Process each input item
const results = [];

for (const item of $input.all()) {
  const userPrompt = item.json.prompt || 'Default prompt';

  const result = await wrapLLMCall(
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      prompt: userPrompt,
      metadata: {
        project: 'n8n-workflow',
        feature: 'automation',
        workflowId: $workflow.id,
        executionId: $execution.id,
      }
    },
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const output = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\\n');

      return { output, usage: message.usage };
    }
  );

  results.push({
    json: {
      ...item.json,
      ai_response: result.output,
      cost: result.cost,
      tokens: { in: result.tokensIn, out: result.tokensOut },
      latency_ms: result.latencyMs,
    }
  });
}

return results;
`;

// =============================================================================
// EXAMPLE 4: Cost Reporting and Analytics
// =============================================================================

/**
 * Example: Generate cost reports
 *
 * This shows how to query and analyze LLM usage and costs
 * across projects, features, and time periods.
 */
export async function example4_CostReporting() {
  // Get monthly cost report for Track App
  const monthlyReport = await getCostReport({
    project: 'track-app',
    startDate: '2024-11-01',
    endDate: '2024-11-30',
  });

  console.log('=== Monthly Cost Report: Track App ===');
  console.log(`Total Calls: ${monthlyReport.totalCalls}`);
  console.log(`Total Cost: $${monthlyReport.totalCost.toFixed(2)}`);
  console.log(`Total Tokens: ${monthlyReport.totalTokensIn + monthlyReport.totalTokensOut}`);
  console.log(`Average Latency: ${monthlyReport.avgLatencyMs.toFixed(0)}ms`);
  console.log('\nBy Model:');
  Object.entries(monthlyReport.byModel).forEach(([model, stats]) => {
    console.log(
      `  ${model}: ${stats.calls} calls, $${stats.cost.toFixed(4)}, ${stats.tokens} tokens`
    );
  });

  // Get feature-specific report
  const featureReport = await getCostReport({
    project: 'track-app',
    feature: 'ai-coaching',
    startDate: '2024-11-01',
    endDate: '2024-11-30',
  });

  console.log('\n=== Feature Report: AI Coaching ===');
  console.log(`Total Cost: $${featureReport.totalCost.toFixed(2)}`);
  console.log(`Calls: ${featureReport.totalCalls}`);
  console.log(`Avg Cost per Call: $${(featureReport.totalCost / featureReport.totalCalls).toFixed(4)}`);

  return { monthlyReport, featureReport };
}

// =============================================================================
// EXAMPLE 5: Error Handling
// =============================================================================

/**
 * Example: Handling errors with telemetry
 *
 * This shows how errors are tracked and logged automatically.
 */
export async function example5_ErrorHandling() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const result = await wrapLLMCall(
      {
        provider: 'anthropic',
        model: 'invalid-model', // This will fail
        prompt: 'Test prompt',
        metadata: {
          project: 'test',
          feature: 'error-handling',
        },
      },
      async () => {
        // This call will fail due to invalid model
        const message = await anthropic.messages.create({
          model: 'invalid-model' as any,
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Test' }],
        });

        return {
          output: '',
          usage: message.usage,
        };
      }
    );

    console.log('Result:', result);
  } catch (error) {
    // Error is logged to telemetry automatically
    console.error('LLM call failed:', error);
    // The error details are already logged to llm_logs table with error field populated
  }
}

// =============================================================================
// EXAMPLE 6: Batch Processing with Progress Tracking
// =============================================================================

/**
 * Example: Process multiple items with cost tracking
 *
 * Useful for batch jobs where you want to track total costs.
 */
export async function example6_BatchProcessing() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5'];

  let totalCost = 0;
  let totalLatency = 0;
  const results = [];

  for (let i = 0; i < sessions.length; i++) {
    const sessionId = sessions[i];

    const result = await wrapLLMCall(
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        prompt: `Generate coaching for session ${sessionId}`,
        metadata: {
          project: 'track-app',
          feature: 'ai-coaching',
          sessionId: sessionId,
          batchId: 'batch-001',
          batchProgress: `${i + 1}/${sessions.length}`,
        },
      },
      async () => {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: `Generate coaching for session ${sessionId}` }],
        });

        const output = message.content
          .filter((block) => block.type === 'text')
          .map((block) => (block as any).text)
          .join('\n');

        return { output, usage: message.usage };
      }
    );

    totalCost += result.cost;
    totalLatency += result.latencyMs;
    results.push(result);

    console.log(`[${i + 1}/${sessions.length}] Cost: $${result.cost.toFixed(4)}, Latency: ${result.latencyMs}ms`);
  }

  console.log('\n=== Batch Complete ===');
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Average Cost: $${(totalCost / sessions.length).toFixed(4)}`);
  console.log(`Average Latency: ${(totalLatency / sessions.length).toFixed(0)}ms`);

  return results;
}

// =============================================================================
// Quick Start Guide
// =============================================================================

/**
 * QUICK START GUIDE
 *
 * 1. Install the library (already in your project):
 *    import { wrapLLMCall } from '@/lib/llm-telemetry';
 *
 * 2. Wrap your LLM call:
 *    const result = await wrapLLMCall(options, callFn);
 *
 * 3. Enable Supabase logging (optional):
 *    Set environment variable: LLM_TELEMETRY_SUPABASE=true
 *
 * 4. View logs:
 *    - Development: Check console output
 *    - Production: Query llm_logs table in Supabase
 *
 * 5. Generate reports:
 *    const report = await getCostReport({ project: 'my-project' });
 */
