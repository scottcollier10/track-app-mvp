/**
 * Brief Parser and Validator
 *
 * Provides functions to normalize raw text into structured briefs using LLMs.
 * This module defines the interface and structure - actual LLM integration
 * should be implemented by the consuming application.
 *
 * @module brief-parser
 */

import type {
  GenericBrief,
  BriefType,
  BriefNormalizationResult,
  BriefIssue
} from './brief-schema';
import {
  isGenericBrief,
  calculateOverallQuality,
  needsRevision
} from './brief-schema';
import {
  buildBriefNormalizationPrompt,
  buildQuickValidationPrompt,
  type PromptOptions
} from './brief-normalization-prompt';

/**
 * Options for normalizing a brief
 */
export interface NormalizationOptions {
  /** LLM model to use (e.g., 'gpt-4', 'claude-3-opus') */
  model?: string;

  /** Whether to use strict validation (higher quality bar) */
  strictMode?: boolean;

  /** Minimum quality threshold (0-100) for flagging as needs revision */
  qualityThreshold?: number;

  /** Custom instructions for the normalization prompt */
  customInstructions?: string;

  /** Whether to include improvement suggestions in issues */
  includeSuggestions?: boolean;

  /** Maximum tokens for LLM response */
  maxTokens?: number;

  /** Temperature for LLM (0-1, lower = more deterministic) */
  temperature?: number;
}

/**
 * Abstract LLM client interface
 * Applications should implement this to integrate their LLM provider
 */
export interface LLMClient {
  /**
   * Generate a completion from a prompt
   * @param prompt - The prompt to send to the LLM
   * @param options - Options for the generation
   * @returns The LLM's response text
   */
  generate(
    prompt: string,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string>;
}

/**
 * Validates that a parsed object matches the GenericBrief schema
 *
 * @param obj - Object to validate
 * @returns Validation result with errors if invalid
 */
export function validateBriefSchema(obj: unknown): {
  valid: boolean;
  errors: string[];
  brief?: GenericBrief;
} {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, errors: ['Input is not an object'] };
  }

  const brief = obj as Partial<GenericBrief>;

  // Check required fields
  if (!brief.id || typeof brief.id !== 'string') {
    errors.push('Missing or invalid field: id');
  }
  if (!brief.type || typeof brief.type !== 'string') {
    errors.push('Missing or invalid field: type');
  }
  if (!brief.title || typeof brief.title !== 'string') {
    errors.push('Missing or invalid field: title');
  }
  if (!brief.description || typeof brief.description !== 'string') {
    errors.push('Missing or invalid field: description');
  }

  // Check quality scores
  if (typeof brief.completeness !== 'number' || brief.completeness < 0 || brief.completeness > 100) {
    errors.push('Invalid completeness score (must be 0-100)');
  }
  if (typeof brief.clarity !== 'number' || brief.clarity < 0 || brief.clarity > 100) {
    errors.push('Invalid clarity score (must be 0-100)');
  }
  if (typeof brief.specificity !== 'number' || brief.specificity < 0 || brief.specificity > 100) {
    errors.push('Invalid specificity score (must be 0-100)');
  }

  // Check issues array
  if (!Array.isArray(brief.issues)) {
    errors.push('Missing or invalid field: issues (must be array)');
  } else {
    brief.issues.forEach((issue, i) => {
      if (!issue.severity || !['critical', 'moderate', 'minor'].includes(issue.severity)) {
        errors.push(`Issue ${i}: invalid severity`);
      }
      if (!issue.category || typeof issue.category !== 'string') {
        errors.push(`Issue ${i}: missing or invalid category`);
      }
      if (!issue.description || typeof issue.description !== 'string') {
        errors.push(`Issue ${i}: missing or invalid description`);
      }
    });
  }

  // Check metadata
  if (!brief.rawInput || typeof brief.rawInput !== 'string') {
    errors.push('Missing or invalid field: rawInput');
  }

  // Convert normalizedAt to Date if it's a string
  if (brief.normalizedAt) {
    if (typeof brief.normalizedAt === 'string') {
      brief.normalizedAt = new Date(brief.normalizedAt);
    }
    if (!(brief.normalizedAt instanceof Date) || isNaN(brief.normalizedAt.getTime())) {
      errors.push('Invalid field: normalizedAt (must be valid date)');
    }
  } else {
    errors.push('Missing field: normalizedAt');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    brief: brief as GenericBrief
  };
}

/**
 * Parses LLM response JSON and validates it
 *
 * @param response - Raw LLM response text
 * @returns Parsed and validated brief
 * @throws Error if parsing or validation fails
 */
export function parseLLMResponse(response: string): GenericBrief {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Validate schema
  const validation = validateBriefSchema(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid brief schema: ${validation.errors.join(', ')}`);
  }

  return validation.brief!;
}

/**
 * Normalizes a raw brief into structured data using an LLM
 *
 * This is the main entry point for brief normalization. It:
 * 1. Builds an appropriate prompt for the brief type
 * 2. Calls the LLM to analyze and structure the brief
 * 3. Parses and validates the response
 * 4. Returns the normalized brief with quality metrics
 *
 * @param rawInput - The raw, unstructured brief text
 * @param briefType - Type of brief being processed
 * @param llmClient - LLM client implementation
 * @param options - Optional configuration
 * @returns Normalized brief with quality assessment
 *
 * @example
 * ```typescript
 * const result = await normalizeBrief(
 *   "need 3 blog posts about AI for developers by next month",
 *   "marketing",
 *   myLLMClient,
 *   { strictMode: true, model: 'gpt-4' }
 * );
 *
 * if (result.needsRevision) {
 *   console.log("Brief needs improvement:", result.brief.issues);
 * }
 * ```
 */
export async function normalizeBrief(
  rawInput: string,
  briefType: BriefType,
  llmClient: LLMClient,
  options: NormalizationOptions = {}
): Promise<BriefNormalizationResult> {
  const startTime = Date.now();

  // Build prompt
  const promptOptions: PromptOptions = {
    briefType,
    strictMode: options.strictMode ?? false,
    qualityThreshold: options.qualityThreshold ?? 70,
    customInstructions: options.customInstructions,
    includeSuggestions: options.includeSuggestions ?? true
  };

  const prompt = buildBriefNormalizationPrompt(rawInput, promptOptions);

  // Call LLM
  const response = await llmClient.generate(prompt, {
    model: options.model,
    maxTokens: options.maxTokens ?? 2000,
    temperature: options.temperature ?? 0.2
  });

  // Parse response
  const brief = parseLLMResponse(response);

  // Calculate metrics
  const qualityScore = calculateOverallQuality(brief);
  const needsRev = needsRevision(brief, options.qualityThreshold);

  const processingTimeMs = Date.now() - startTime;

  return {
    brief,
    qualityScore,
    needsRevision: needsRev,
    confidence: calculateConfidenceScore(brief),
    metadata: {
      processingTimeMs,
      model: options.model
    }
  };
}

/**
 * Performs a quick validation check without full normalization
 *
 * @param rawInput - The brief text to validate
 * @param briefType - Type of brief
 * @param llmClient - LLM client implementation
 * @returns Quick validation result
 */
export async function quickValidate(
  rawInput: string,
  briefType: BriefType,
  llmClient: LLMClient
): Promise<{
  qualityScore: number;
  needsWork: boolean;
  topIssues: string[];
  strengths: string[];
}> {
  const prompt = buildQuickValidationPrompt(rawInput, briefType);

  const response = await llmClient.generate(prompt, {
    maxTokens: 500,
    temperature: 0.2
  });

  // Parse response (expecting simpler JSON)
  const cleaned = response.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');

  return JSON.parse(cleaned);
}

/**
 * Calculates confidence score based on brief characteristics
 * Higher confidence = LLM had clear input to work with
 *
 * @param brief - The normalized brief
 * @returns Confidence score (0-100)
 */
function calculateConfidenceScore(brief: GenericBrief): number {
  let confidence = 80; // Start with baseline

  // Reduce confidence for issues
  const criticalIssues = brief.issues.filter(i => i.severity === 'critical').length;
  const moderateIssues = brief.issues.filter(i => i.severity === 'moderate').length;

  confidence -= criticalIssues * 15;
  confidence -= moderateIssues * 5;

  // Reduce confidence if raw input is very short
  if (brief.rawInput.length < 50) {
    confidence -= 20;
  } else if (brief.rawInput.length < 100) {
    confidence -= 10;
  }

  // Increase confidence if quality scores are high
  const avgQuality = (brief.completeness + brief.clarity + brief.specificity) / 3;
  if (avgQuality > 85) {
    confidence += 10;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Batch normalize multiple briefs
 *
 * @param briefs - Array of raw brief texts
 * @param briefType - Type of briefs
 * @param llmClient - LLM client implementation
 * @param options - Normalization options
 * @returns Array of normalization results
 */
export async function normalizeBriefs(
  briefs: string[],
  briefType: BriefType,
  llmClient: LLMClient,
  options: NormalizationOptions = {}
): Promise<BriefNormalizationResult[]> {
  // Process briefs in parallel (with reasonable concurrency limit)
  const results: BriefNormalizationResult[] = [];

  // Process in batches of 5 to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < briefs.length; i += batchSize) {
    const batch = briefs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(brief => normalizeBrief(brief, briefType, llmClient, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Mock LLM client for testing and examples
 * Returns a structured response without calling a real LLM
 */
export class MockLLMClient implements LLMClient {
  async generate(prompt: string): Promise<string> {
    // This is a mock - in real usage, replace with actual LLM call
    return JSON.stringify({
      id: `brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'marketing',
      title: 'Mock Normalized Brief',
      description: 'This is a mock normalization for testing purposes',
      targetAudience: 'Developers',
      goals: ['Test the normalization system'],
      constraints: ['No actual LLM available'],
      deliverables: [
        {
          type: 'documentation',
          description: 'Working normalization system',
          quantity: 1
        }
      ],
      completeness: 75,
      clarity: 80,
      specificity: 70,
      issues: [
        {
          severity: 'moderate',
          category: 'testing',
          description: 'Using mock LLM instead of real one',
          suggestion: 'Integrate with actual LLM provider'
        }
      ],
      rawInput: prompt.substring(0, 100) + '...',
      normalizedAt: new Date().toISOString()
    });
  }
}
