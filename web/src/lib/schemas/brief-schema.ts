/**
 * Generic Brief Schema
 *
 * A reusable schema for normalizing messy briefs into structured data.
 * Can be adapted for: marketing briefs, job descriptions, feature requests,
 * client intake forms, and more.
 *
 * @module brief-schema
 */

/**
 * Severity level for issues found during brief analysis
 */
export type IssueSeverity = 'critical' | 'moderate' | 'minor';

/**
 * Type of brief being processed
 */
export type BriefType = 'marketing' | 'product' | 'content' | 'job' | 'custom';

/**
 * An issue or gap identified in the brief
 */
export interface BriefIssue {
  /** Severity of the issue */
  severity: IssueSeverity;
  /** Category or domain of the issue (e.g., 'deadline', 'audience', 'scope') */
  category: string;
  /** Human-readable description of the issue */
  description: string;
  /** Optional suggestion for addressing the issue */
  suggestion?: string;
}

/**
 * A deliverable or output expected from the brief
 */
export interface BriefDeliverable {
  /** Type of deliverable (e.g., 'blog post', 'video', 'feature', 'design') */
  type: string;
  /** Detailed description of the deliverable */
  description: string;
  /** Optional due date in ISO 8601 format */
  dueDate?: string;
  /** Optional quantity (e.g., "3 blog posts") */
  quantity?: number;
  /** Optional format specifications (e.g., "1200 words", "16:9 video") */
  format?: string;
}

/**
 * Generic brief schema that can be extended for domain-specific needs
 *
 * @example
 * ```typescript
 * const brief: GenericBrief = {
 *   id: 'brief-123',
 *   type: 'marketing',
 *   title: 'Q4 Product Launch Campaign',
 *   description: 'Multi-channel campaign for new product release',
 *   targetAudience: 'B2B SaaS decision makers',
 *   goals: ['Generate 500 leads', 'Achieve 10% conversion rate'],
 *   completeness: 85,
 *   clarity: 90,
 *   specificity: 75,
 *   issues: [],
 *   rawInput: '...',
 *   normalizedAt: new Date()
 * };
 * ```
 */
export interface GenericBrief {
  // ============================================================
  // CORE FIELDS (always present)
  // ============================================================

  /** Unique identifier for the brief */
  id: string;

  /** Type of brief being processed */
  type: BriefType;

  /** Clear, concise title for the brief */
  title: string;

  /** Comprehensive description of what's being requested */
  description: string;

  // ============================================================
  // CONTEXT FIELDS (optional but recommended)
  // ============================================================

  /** Target audience or user persona */
  targetAudience?: string;

  /** List of goals or objectives to achieve */
  goals?: string[];

  /** Constraints, limitations, or requirements (budget, timeline, tech stack, etc.) */
  constraints?: string[];

  /** Background context or additional information */
  background?: string;

  /** Success criteria or metrics */
  successCriteria?: string[];

  // ============================================================
  // DELIVERABLES
  // ============================================================

  /** Specific outputs or artifacts expected */
  deliverables?: BriefDeliverable[];

  // ============================================================
  // QUALITY METADATA (0-100 scores)
  // ============================================================

  /**
   * How complete is the brief? Are all necessary fields present?
   * 0 = Missing critical information
   * 100 = All expected fields are present and filled
   */
  completeness: number;

  /**
   * How clear and unambiguous is the brief?
   * 0 = Confusing, contradictory, or vague
   * 100 = Crystal clear with no ambiguity
   */
  clarity: number;

  /**
   * How specific and detailed is the brief?
   * 0 = Very vague or generic
   * 100 = Highly specific with concrete details
   */
  specificity: number;

  // ============================================================
  // ISSUES & FEEDBACK
  // ============================================================

  /** List of issues, gaps, or concerns identified during analysis */
  issues: BriefIssue[];

  // ============================================================
  // METADATA
  // ============================================================

  /** Original raw input text before normalization */
  rawInput: string;

  /** Timestamp when the brief was normalized */
  normalizedAt: Date;

  /** Optional: Version of the normalization schema used */
  schemaVersion?: string;

  /** Optional: Model or system that performed the normalization */
  normalizedBy?: string;
}

/**
 * Result of normalizing a brief
 */
export interface BriefNormalizationResult {
  /** The normalized brief */
  brief: GenericBrief;

  /** Overall quality score (0-100) */
  qualityScore: number;

  /** Whether the brief needs revision before proceeding */
  needsRevision: boolean;

  /** Optional: Confidence score in the normalization (0-100) */
  confidence?: number;

  /** Optional: Processing metadata */
  metadata?: {
    processingTimeMs?: number;
    model?: string;
    tokensUsed?: number;
  };
}

/**
 * Type guard to check if an object is a valid GenericBrief
 */
export function isGenericBrief(obj: unknown): obj is GenericBrief {
  if (typeof obj !== 'object' || obj === null) return false;

  const brief = obj as Partial<GenericBrief>;

  return (
    typeof brief.id === 'string' &&
    typeof brief.type === 'string' &&
    typeof brief.title === 'string' &&
    typeof brief.description === 'string' &&
    typeof brief.completeness === 'number' &&
    typeof brief.clarity === 'number' &&
    typeof brief.specificity === 'number' &&
    Array.isArray(brief.issues) &&
    typeof brief.rawInput === 'string' &&
    brief.normalizedAt instanceof Date
  );
}

/**
 * Helper to calculate overall quality score from component scores
 */
export function calculateOverallQuality(brief: GenericBrief): number {
  // Weight completeness more heavily as it's most critical
  const weights = {
    completeness: 0.4,
    clarity: 0.3,
    specificity: 0.3,
  };

  return Math.round(
    brief.completeness * weights.completeness +
    brief.clarity * weights.clarity +
    brief.specificity * weights.specificity
  );
}

/**
 * Helper to determine if a brief needs revision based on quality thresholds
 */
export function needsRevision(brief: GenericBrief, threshold = 70): boolean {
  const overallScore = calculateOverallQuality(brief);
  const hasCriticalIssues = brief.issues.some(issue => issue.severity === 'critical');

  return overallScore < threshold || hasCriticalIssues;
}
