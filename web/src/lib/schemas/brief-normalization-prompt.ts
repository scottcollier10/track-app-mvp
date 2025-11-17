/**
 * Brief Normalization Prompt Templates
 *
 * Generates prompts for LLMs to normalize messy brief text into structured JSON.
 * Inspired by Content Ops Copilot W01/W02 workflows.
 *
 * @module brief-normalization-prompt
 */

import type { BriefType } from './brief-schema';

/**
 * Domain-specific field configurations
 */
const DOMAIN_FIELDS: Record<BriefType, {
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  examples: string;
}> = {
  marketing: {
    description: 'Marketing or content brief',
    requiredFields: ['campaign objective', 'target audience', 'key messages', 'channels'],
    optionalFields: ['budget', 'timeline', 'brand guidelines', 'tone of voice', 'competitors'],
    examples: `
Examples of marketing briefs:
- "Need 3 blog posts about AI for B2B SaaS audience, due next month"
- "Launch campaign for new product, targeting millennials, budget $50k"
- "Social media content calendar for Q4, focus on engagement"
    `.trim()
  },

  product: {
    description: 'Product or feature brief',
    requiredFields: ['feature description', 'user problem', 'success metrics'],
    optionalFields: ['technical constraints', 'dependencies', 'timeline', 'priority'],
    examples: `
Examples of product briefs:
- "Add dark mode to mobile app, users complaining about eye strain"
- "Build CSV export feature for analytics dashboard"
- "Improve onboarding flow, current completion rate is 40%"
    `.trim()
  },

  content: {
    description: 'Content creation brief',
    requiredFields: ['content type', 'topic', 'audience', 'word count or length'],
    optionalFields: ['SEO keywords', 'references', 'tone', 'format requirements'],
    examples: `
Examples of content briefs:
- "Write a 1500-word guide on email marketing for small businesses"
- "Create video script about product features, 2-3 minutes"
- "Design infographic showing our survey results"
    `.trim()
  },

  job: {
    description: 'Job description or hiring brief',
    requiredFields: ['role title', 'key responsibilities', 'required skills'],
    optionalFields: ['experience level', 'location', 'salary range', 'team size', 'reporting structure'],
    examples: `
Examples of job briefs:
- "Hiring senior frontend engineer, React/TypeScript, remote, $120k-180k"
- "Need marketing manager to lead growth initiatives, 3-5 years exp"
- "Looking for part-time designer for website redesign project"
    `.trim()
  },

  custom: {
    description: 'Custom or general brief',
    requiredFields: ['what is being requested', 'why it\'s needed'],
    optionalFields: ['constraints', 'timeline', 'success criteria'],
    examples: `
Examples of custom briefs:
- "Research competitors in the AI coding assistant space"
- "Plan team offsite for 20 people in Austin, budget $10k"
- "Create onboarding checklist for new engineering hires"
    `.trim()
  }
};

/**
 * Options for customizing the normalization prompt
 */
export interface PromptOptions {
  /** Brief type being processed */
  briefType: BriefType;

  /** Whether to use strict validation (reject low-quality briefs) */
  strictMode?: boolean;

  /** Minimum quality threshold (0-100) */
  qualityThreshold?: number;

  /** Additional domain-specific instructions */
  customInstructions?: string;

  /** Whether to include improvement suggestions */
  includeSuggestions?: boolean;
}

/**
 * Builds a comprehensive prompt for normalizing a brief using an LLM
 *
 * @param rawInput - The raw, unstructured brief text
 * @param options - Configuration options for the prompt
 * @returns A prompt string ready to be sent to an LLM
 *
 * @example
 * ```typescript
 * const prompt = buildBriefNormalizationPrompt(
 *   "need 3 blog posts about AI, target devs, next month",
 *   { briefType: 'marketing', strictMode: true }
 * );
 * // Use prompt with your LLM API
 * ```
 */
export function buildBriefNormalizationPrompt(
  rawInput: string,
  options: PromptOptions
): string {
  const {
    briefType,
    strictMode = false,
    qualityThreshold = 70,
    customInstructions = '',
    includeSuggestions = true
  } = options;

  const domainConfig = DOMAIN_FIELDS[briefType];

  return `You are an expert brief analyzer and normalizer. Your task is to transform messy, unstructured brief text into clean, structured JSON.

# INPUT
${rawInput}

# BRIEF TYPE
${domainConfig.description}

# YOUR TASK
Analyze the input and extract structured information into a JSON object matching this schema:

\`\`\`typescript
{
  "id": "auto-generated-id",
  "type": "${briefType}",
  "title": "clear, concise title",
  "description": "comprehensive description of what's being requested",
  "targetAudience": "who this is for (if applicable)",
  "goals": ["goal 1", "goal 2"],
  "constraints": ["constraint 1", "constraint 2"],
  "deliverables": [
    {
      "type": "deliverable type",
      "description": "what needs to be delivered",
      "dueDate": "ISO 8601 date if mentioned",
      "quantity": 1,
      "format": "format specifications if any"
    }
  ],
  "completeness": 0-100,
  "clarity": 0-100,
  "specificity": 0-100,
  "issues": [
    {
      "severity": "critical" | "moderate" | "minor",
      "category": "category name",
      "description": "what's wrong or missing",
      "suggestion": "how to fix it (optional)"
    }
  ],
  "rawInput": "original input text",
  "normalizedAt": "current ISO timestamp"
}
\`\`\`

# DOMAIN-SPECIFIC REQUIREMENTS
For ${briefType} briefs, pay special attention to:

Required fields to extract:
${domainConfig.requiredFields.map(f => `- ${f}`).join('\n')}

Optional but valuable fields:
${domainConfig.optionalFields.map(f => `- ${f}`).join('\n')}

${domainConfig.examples}

# QUALITY SCORING GUIDELINES

**Completeness (0-100):**
- 100: All required fields present and well-defined
- 75: Most required fields present, some gaps
- 50: Key information present but many gaps
- 25: Minimal information, many critical gaps
- 0: Almost no useful information

**Clarity (0-100):**
- 100: Crystal clear, no ambiguity
- 75: Mostly clear, minor ambiguities
- 50: Some confusing or contradictory elements
- 25: Significant ambiguity or confusion
- 0: Extremely vague or contradictory

**Specificity (0-100):**
- 100: Highly specific with concrete details
- 75: Reasonably specific
- 50: Mix of specific and generic
- 25: Mostly generic or vague
- 0: No specifics at all

# ISSUE SEVERITY LEVELS

**Critical:** Information gaps that would prevent successful execution
- Missing target audience for a marketing brief
- No success criteria for a product feature
- No timeline when time-sensitive

**Moderate:** Missing information that would help but isn't blocking
- No budget specified
- Unclear priority
- Missing background context

**Minor:** Nice-to-have information that's absent
- No references provided
- No competitive context
- No specific metrics

${strictMode ? `
# STRICT MODE ENABLED
Since strict mode is enabled, flag any brief scoring below ${qualityThreshold} as needing revision. Be thorough in identifying issues.
` : ''}

${includeSuggestions ? `
# SUGGESTIONS
For each issue identified, provide a specific, actionable suggestion for how to improve the brief.
` : ''}

${customInstructions ? `
# ADDITIONAL INSTRUCTIONS
${customInstructions}
` : ''}

# OUTPUT FORMAT
Respond with ONLY valid JSON matching the schema above. No additional text, explanations, or markdown.
Ensure all dates are in ISO 8601 format.
Generate a unique ID using a combination of timestamp and random string.

# IMPORTANT
- Extract information that's actually present; don't make up details
- If something is unclear, mark it as an issue rather than guessing
- Be objective in quality scoring
- Focus on what would help someone execute on this brief successfully
`;
}

/**
 * Builds a simpler prompt for quick brief validation (no full normalization)
 *
 * @param rawInput - The raw brief text
 * @param briefType - Type of brief
 * @returns A prompt for quick validation
 */
export function buildQuickValidationPrompt(
  rawInput: string,
  briefType: BriefType
): string {
  return `Analyze this ${briefType} brief and provide a quick quality assessment:

${rawInput}

Respond with JSON:
{
  "qualityScore": 0-100,
  "needsWork": true/false,
  "topIssues": ["issue 1", "issue 2", "issue 3"],
  "strengths": ["strength 1", "strength 2"]
}`;
}

/**
 * Builds a prompt for improving an existing brief
 *
 * @param rawInput - The original brief
 * @param issues - Issues identified in the brief
 * @returns A prompt for generating an improved version
 */
export function buildImprovementPrompt(
  rawInput: string,
  issues: Array<{ description: string; suggestion?: string }>
): string {
  return `Here is a brief that needs improvement:

${rawInput}

Issues identified:
${issues.map((issue, i) => `${i + 1}. ${issue.description}${issue.suggestion ? `\n   Suggestion: ${issue.suggestion}` : ''}`).join('\n')}

Please rewrite this brief to address the issues above. Make it:
- More complete (fill in gaps)
- Clearer (remove ambiguity)
- More specific (add concrete details)

Respond with the improved brief text.`;
}
