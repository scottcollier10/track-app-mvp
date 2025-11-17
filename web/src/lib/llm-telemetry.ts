/**
 * Universal LLM Telemetry and Cost Tracking Library
 *
 * Tracks tokens, costs, latency, and errors for LLM API calls across all providers.
 * Works in Next.js API routes, n8n Code nodes, and Node.js scripts.
 *
 * Usage:
 *   const result = await wrapLLMCall(
 *     { provider: 'anthropic', model: 'claude-sonnet-4-20250514', prompt: '...', metadata: {...} },
 *     async () => {
 *       const response = await anthropic.messages.create({...});
 *       return { output: response.content[0].text, usage: response.usage };
 *     }
 *   );
 */

import { createServerClient } from '@/lib/supabase/client';

/**
 * LLM provider types
 */
export type LLMProvider = 'anthropic' | 'openai' | 'other';

/**
 * Configuration for an LLM API call
 */
export interface LLMCallOptions {
  provider: LLMProvider;
  model: string;
  prompt: string;
  metadata?: {
    project?: string;
    feature?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: any;
  };
}

/**
 * Result of an LLM API call with telemetry
 */
export interface LLMCallResult {
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
  error?: string;
}

/**
 * Usage information from LLM providers
 */
export interface LLMUsage {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Pricing per million tokens (as of Nov 2024)
 */
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },

  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-2024-11-20': { input: 2.5, output: 10.0 },
  'gpt-4o-2024-08-06': { input: 2.5, output: 10.0 },
  'gpt-4o-2024-05-13': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4-turbo-2024-04-09': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },

  // Default fallback
  default: { input: 3.0, output: 15.0 },
};

/**
 * Calculate cost in USD based on token usage
 *
 * @param provider - LLM provider (anthropic, openai, etc.)
 * @param model - Model name/ID
 * @param tokensIn - Input tokens
 * @param tokensOut - Output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = PRICING[model] || PRICING['default'];
  const inputCost = (tokensIn / 1_000_000) * pricing.input;
  const outputCost = (tokensOut / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Normalize usage object from different providers
 *
 * @param usage - Usage object from provider API
 * @returns Normalized token counts
 */
function normalizeUsage(usage: LLMUsage): { tokensIn: number; tokensOut: number } {
  // Anthropic format: { input_tokens, output_tokens }
  if (usage.input_tokens !== undefined && usage.output_tokens !== undefined) {
    return {
      tokensIn: usage.input_tokens,
      tokensOut: usage.output_tokens,
    };
  }

  // OpenAI format: { prompt_tokens, completion_tokens }
  if (usage.prompt_tokens !== undefined && usage.completion_tokens !== undefined) {
    return {
      tokensIn: usage.prompt_tokens,
      tokensOut: usage.completion_tokens,
    };
  }

  // Fallback to zeros if format is unexpected
  console.warn('[LLM Telemetry] Unknown usage format:', usage);
  return { tokensIn: 0, tokensOut: 0 };
}

/**
 * Log LLM call telemetry to console and optionally Supabase
 *
 * @param result - LLM call result with metrics
 * @param options - Original call options with metadata
 */
async function logLLMCall(result: LLMCallResult, options: LLMCallOptions): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development';
  const timestamp = new Date().toISOString();

  // Always log to console
  const logData = {
    timestamp,
    provider: options.provider,
    model: options.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    cost: result.cost,
    latencyMs: result.latencyMs,
    project: options.metadata?.project,
    feature: options.metadata?.feature,
    error: result.error,
  };

  if (isDev) {
    console.log('[LLM Telemetry]', logData);
  } else {
    console.log('[LLM Telemetry]', JSON.stringify(logData));
  }

  // Log to Supabase in production (or if explicitly enabled)
  const enableSupabaseLogging = process.env.LLM_TELEMETRY_SUPABASE === 'true' || !isDev;

  if (enableSupabaseLogging) {
    try {
      const supabase = createServerClient();

      const { error } = await (supabase.from('llm_logs') as any).insert({
        provider: options.provider,
        model: options.model,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: result.cost,
        latency_ms: result.latencyMs,
        project: options.metadata?.project,
        feature: options.metadata?.feature,
        user_id: options.metadata?.userId,
        metadata: options.metadata || {},
        error: result.error,
      });

      if (error) {
        console.error('[LLM Telemetry] Failed to log to Supabase:', error);
      }
    } catch (error) {
      console.error('[LLM Telemetry] Supabase logging error:', error);
      // Don't throw - logging failures should not break the main flow
    }
  }
}

/**
 * Wrap an LLM API call with telemetry tracking
 *
 * Automatically tracks:
 * - Token usage (input/output)
 * - Cost in USD
 * - Latency in milliseconds
 * - Errors
 *
 * Logs to console (dev) and Supabase (production)
 *
 * @param options - Call configuration (provider, model, metadata)
 * @param callFn - Async function that makes the actual LLM API call
 * @returns Result object with output, metrics, and any errors
 *
 * @example
 * ```typescript
 * const result = await wrapLLMCall(
 *   {
 *     provider: 'anthropic',
 *     model: 'claude-sonnet-4-20250514',
 *     prompt: 'Hello, world!',
 *     metadata: { project: 'track-app', feature: 'ai-coaching' }
 *   },
 *   async () => {
 *     const response = await anthropic.messages.create({
 *       model: 'claude-sonnet-4-20250514',
 *       max_tokens: 1500,
 *       messages: [{ role: 'user', content: 'Hello, world!' }]
 *     });
 *     return {
 *       output: response.content[0].text,
 *       usage: response.usage
 *     };
 *   }
 * );
 * ```
 */
export async function wrapLLMCall(
  options: LLMCallOptions,
  callFn: () => Promise<{ output: string; usage: LLMUsage }>
): Promise<LLMCallResult> {
  const startTime = Date.now();
  let result: LLMCallResult;

  try {
    // Execute the LLM call
    const response = await callFn();

    // Calculate metrics
    const latencyMs = Date.now() - startTime;
    const { tokensIn, tokensOut } = normalizeUsage(response.usage);
    const cost = calculateCost(options.provider, options.model, tokensIn, tokensOut);

    result = {
      output: response.output,
      tokensIn,
      tokensOut,
      cost,
      latencyMs,
    };
  } catch (error) {
    // Handle errors
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    result = {
      output: '',
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      latencyMs,
      error: errorMessage,
    };
  }

  // Log the call
  await logLLMCall(result, options);

  // Throw error if the call failed
  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

/**
 * Get cost report for a project/feature
 *
 * @param filters - Optional filters (project, feature, dateRange)
 * @returns Summary of costs and usage
 *
 * @example
 * ```typescript
 * const report = await getCostReport({
 *   project: 'track-app',
 *   startDate: '2024-11-01',
 *   endDate: '2024-11-30'
 * });
 * console.log(`Total cost: $${report.totalCost}`);
 * ```
 */
export async function getCostReport(filters?: {
  project?: string;
  feature?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  totalCost: number;
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgLatencyMs: number;
  byModel: Record<string, { calls: number; cost: number; tokens: number }>;
}> {
  try {
    const supabase = createServerClient();
    let query = (supabase.from('llm_logs') as any).select('*');

    // Apply filters
    if (filters?.project) {
      query = query.eq('project', filters.project);
    }
    if (filters?.feature) {
      query = query.eq('feature', filters.feature);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('[LLM Telemetry] Failed to fetch cost report:', error);
      throw error;
    }

    // Aggregate metrics
    const byModel: Record<string, { calls: number; cost: number; tokens: number }> = {};
    let totalCost = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalLatency = 0;

    logs.forEach((log: any) => {
      totalCost += Number(log.cost_usd) || 0;
      totalTokensIn += log.tokens_in || 0;
      totalTokensOut += log.tokens_out || 0;
      totalLatency += log.latency_ms || 0;

      const model = log.model;
      if (!byModel[model]) {
        byModel[model] = { calls: 0, cost: 0, tokens: 0 };
      }
      byModel[model].calls++;
      byModel[model].cost += Number(log.cost_usd) || 0;
      byModel[model].tokens += (log.tokens_in || 0) + (log.tokens_out || 0);
    });

    return {
      totalCost,
      totalCalls: logs.length,
      totalTokensIn,
      totalTokensOut,
      avgLatencyMs: logs.length > 0 ? totalLatency / logs.length : 0,
      byModel,
    };
  } catch (error) {
    console.error('[LLM Telemetry] Cost report error:', error);
    throw error;
  }
}
