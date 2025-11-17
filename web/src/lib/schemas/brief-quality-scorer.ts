/**
 * Brief Quality Scoring System
 *
 * Advanced quality assessment for normalized briefs. Goes beyond the basic
 * scores (completeness, clarity, specificity) to provide deeper analysis.
 *
 * @module brief-quality-scorer
 */

import type { GenericBrief, BriefIssue } from './brief-schema';
import { calculateOverallQuality, needsRevision } from './brief-schema';

/**
 * Comprehensive quality assessment result
 */
export interface BriefQualityScore {
  /** Overall quality score (0-100) */
  overallScore: number;

  /** Component scores */
  completeness: number;
  clarity: number;
  specificity: number;
  actionability: number;

  /** Whether the brief needs revision before execution */
  needsRevision: boolean;

  /** Specific suggestions for improvement */
  suggestions: string[];

  /** Strengths identified in the brief */
  strengths: string[];

  /** Confidence in the quality assessment (0-100) */
  confidence: number;

  /** Breakdown by issue severity */
  issueSummary: {
    critical: number;
    moderate: number;
    minor: number;
    total: number;
  };
}

/**
 * Scores a brief across multiple quality dimensions
 *
 * @param brief - The brief to score
 * @param options - Scoring options
 * @returns Comprehensive quality assessment
 *
 * @example
 * ```typescript
 * const score = scoreBrief(normalizedBrief);
 * console.log(`Overall quality: ${score.overallScore}/100`);
 * if (score.needsRevision) {
 *   console.log('Suggestions:', score.suggestions);
 * }
 * ```
 */
export function scoreBrief(
  brief: GenericBrief,
  options: {
    /** Threshold for flagging as needs revision (default: 70) */
    revisionThreshold?: number;
    /** Whether to include detailed suggestions (default: true) */
    includeSuggestions?: boolean;
  } = {}
): BriefQualityScore {
  const revisionThreshold = options.revisionThreshold ?? 70;
  const includeSuggestions = options.includeSuggestions ?? true;

  // Use existing scores from brief
  const completeness = brief.completeness;
  const clarity = brief.clarity;
  const specificity = brief.specificity;

  // Calculate actionability score
  const actionability = calculateActionability(brief);

  // Calculate overall score (weighted average)
  const overallScore = calculateWeightedQuality({
    completeness,
    clarity,
    specificity,
    actionability
  });

  // Determine if needs revision
  const needsRev = needsRevision(brief, revisionThreshold);

  // Generate suggestions
  const suggestions = includeSuggestions ? generateSuggestions(brief) : [];

  // Identify strengths
  const strengths = identifyStrengths(brief);

  // Calculate confidence
  const confidence = calculateScoringConfidence(brief);

  // Summarize issues
  const issueSummary = summarizeIssues(brief.issues);

  return {
    overallScore,
    completeness,
    clarity,
    specificity,
    actionability,
    needsRevision: needsRev,
    suggestions,
    strengths,
    confidence,
    issueSummary
  };
}

/**
 * Calculates actionability score - can someone immediately act on this brief?
 *
 * @param brief - The brief to assess
 * @returns Actionability score (0-100)
 */
export function calculateActionability(brief: GenericBrief): number {
  let score = 100;

  // Penalize if no clear deliverables
  if (!brief.deliverables || brief.deliverables.length === 0) {
    score -= 20;
  }

  // Penalize if no goals
  if (!brief.goals || brief.goals.length === 0) {
    score -= 15;
  }

  // Penalize if no target audience (for relevant brief types)
  if (!brief.targetAudience && ['marketing', 'content'].includes(brief.type)) {
    score -= 15;
  }

  // Penalize if no success criteria
  if (!brief.successCriteria || brief.successCriteria.length === 0) {
    score -= 10;
  }

  // Penalize for critical issues
  const criticalIssues = brief.issues.filter(i => i.severity === 'critical').length;
  score -= criticalIssues * 15;

  // Penalize for moderate issues
  const moderateIssues = brief.issues.filter(i => i.severity === 'moderate').length;
  score -= moderateIssues * 5;

  // Boost if deliverables have due dates
  const deliverablesWithDates = brief.deliverables?.filter(d => d.dueDate).length || 0;
  const deliverableCount = brief.deliverables?.length || 1;
  if (deliverablesWithDates > 0) {
    score += Math.min(10, (deliverablesWithDates / deliverableCount) * 10);
  }

  // Boost if constraints are clearly defined
  if (brief.constraints && brief.constraints.length > 0) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculates weighted quality score across all dimensions
 */
function calculateWeightedQuality(scores: {
  completeness: number;
  clarity: number;
  specificity: number;
  actionability: number;
}): number {
  // Completeness is most important, followed by actionability
  const weights = {
    completeness: 0.35,
    clarity: 0.25,
    specificity: 0.20,
    actionability: 0.20
  };

  const weighted =
    scores.completeness * weights.completeness +
    scores.clarity * weights.clarity +
    scores.specificity * weights.specificity +
    scores.actionability * weights.actionability;

  return Math.round(weighted);
}

/**
 * Generates specific, actionable suggestions for improving the brief
 */
function generateSuggestions(brief: GenericBrief): string[] {
  const suggestions: string[] = [];

  // Check completeness
  if (brief.completeness < 70) {
    if (!brief.deliverables || brief.deliverables.length === 0) {
      suggestions.push('Add specific deliverables with clear descriptions');
    }
    if (!brief.goals || brief.goals.length === 0) {
      suggestions.push('Define clear goals or objectives');
    }
    if (!brief.targetAudience) {
      suggestions.push('Specify the target audience or user persona');
    }
    if (!brief.successCriteria || brief.successCriteria.length === 0) {
      suggestions.push('Define success criteria or metrics');
    }
  }

  // Check clarity
  if (brief.clarity < 70) {
    suggestions.push('Clarify ambiguous language and remove contradictions');
    suggestions.push('Use more precise terminology and avoid vague terms');
  }

  // Check specificity
  if (brief.specificity < 70) {
    suggestions.push('Add concrete details like quantities, dates, and formats');
    suggestions.push('Replace generic statements with specific examples');
  }

  // Check for missing dates
  const hasAnyDates = brief.deliverables?.some(d => d.dueDate);
  if (!hasAnyDates && brief.deliverables && brief.deliverables.length > 0) {
    suggestions.push('Add due dates or timeline for deliverables');
  }

  // Add suggestions from issues
  brief.issues
    .filter(issue => issue.severity === 'critical' && issue.suggestion)
    .forEach(issue => {
      if (issue.suggestion) {
        suggestions.push(issue.suggestion);
      }
    });

  // Deduplicate suggestions
  return Array.from(new Set(suggestions));
}

/**
 * Identifies strengths in the brief
 */
function identifyStrengths(brief: GenericBrief): string[] {
  const strengths: string[] = [];

  // High quality scores
  if (brief.completeness >= 85) {
    strengths.push('Comprehensive information provided');
  }
  if (brief.clarity >= 85) {
    strengths.push('Crystal clear and unambiguous');
  }
  if (brief.specificity >= 85) {
    strengths.push('Highly specific with concrete details');
  }

  // Well-defined elements
  if (brief.deliverables && brief.deliverables.length > 0) {
    const withDates = brief.deliverables.filter(d => d.dueDate).length;
    if (withDates === brief.deliverables.length) {
      strengths.push('All deliverables have clear deadlines');
    }
  }

  if (brief.goals && brief.goals.length >= 3) {
    strengths.push('Multiple clear goals defined');
  }

  if (brief.successCriteria && brief.successCriteria.length >= 3) {
    strengths.push('Measurable success criteria specified');
  }

  if (brief.constraints && brief.constraints.length > 0) {
    strengths.push('Constraints and limitations clearly stated');
  }

  if (brief.background) {
    strengths.push('Good context and background provided');
  }

  // Few issues
  if (brief.issues.length === 0) {
    strengths.push('No issues identified - ready for execution');
  } else if (brief.issues.filter(i => i.severity === 'critical').length === 0) {
    strengths.push('No critical issues blocking execution');
  }

  return strengths;
}

/**
 * Calculates confidence in the quality scoring
 * High confidence = brief is easy to assess
 */
function calculateScoringConfidence(brief: GenericBrief): number {
  let confidence = 80; // Baseline

  // Very short briefs are hard to assess
  if (brief.rawInput.length < 50) {
    confidence -= 30;
  } else if (brief.rawInput.length < 100) {
    confidence -= 15;
  }

  // Very long briefs are easier to assess
  if (brief.rawInput.length > 500) {
    confidence += 10;
  }

  // Lots of critical issues suggest uncertainty
  const criticalIssues = brief.issues.filter(i => i.severity === 'critical').length;
  confidence -= criticalIssues * 10;

  // High variance in scores suggests uncertainty
  const scores = [brief.completeness, brief.clarity, brief.specificity];
  const variance = calculateVariance(scores);
  if (variance > 500) {
    // High variance
    confidence -= 15;
  }

  // Very low scores suggest the brief is genuinely bad (high confidence)
  const avgScore = scores.reduce((a, b) => a + b) / scores.length;
  if (avgScore < 30) {
    confidence = Math.max(confidence, 75);
  }

  // Very high scores suggest the brief is genuinely good (high confidence)
  if (avgScore > 85) {
    confidence = Math.max(confidence, 80);
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Helper to calculate variance
 */
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b) / numbers.length;
  const squareDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squareDiffs.reduce((a, b) => a + b) / numbers.length;
}

/**
 * Summarizes issues by severity
 */
function summarizeIssues(issues: BriefIssue[]): {
  critical: number;
  moderate: number;
  minor: number;
  total: number;
} {
  return {
    critical: issues.filter(i => i.severity === 'critical').length,
    moderate: issues.filter(i => i.severity === 'moderate').length,
    minor: issues.filter(i => i.severity === 'minor').length,
    total: issues.length
  };
}

/**
 * Compares two briefs and shows quality improvements
 *
 * @param before - Original brief
 * @param after - Revised brief
 * @returns Comparison showing improvements or regressions
 */
export function compareBriefQuality(
  before: GenericBrief,
  after: GenericBrief
): {
  improved: boolean;
  overallChange: number;
  changes: {
    dimension: string;
    before: number;
    after: number;
    change: number;
    improved: boolean;
  }[];
  summary: string;
} {
  const beforeScore = scoreBrief(before);
  const afterScore = scoreBrief(after);

  const dimensions = ['completeness', 'clarity', 'specificity', 'actionability'] as const;

  const changes = dimensions.map(dim => {
    const beforeVal = beforeScore[dim];
    const afterVal = afterScore[dim];
    const change = afterVal - beforeVal;

    return {
      dimension: dim,
      before: beforeVal,
      after: afterVal,
      change,
      improved: change > 0
    };
  });

  const overallChange = afterScore.overallScore - beforeScore.overallScore;
  const improved = overallChange > 0;

  let summary: string;
  if (overallChange > 15) {
    summary = 'Significant improvement! Brief is much stronger.';
  } else if (overallChange > 5) {
    summary = 'Good improvement. Brief quality has increased.';
  } else if (overallChange > -5) {
    summary = 'Minimal change. Consider more substantial revisions.';
  } else {
    summary = 'Quality decreased. Revert changes or try different approach.';
  }

  return {
    improved,
    overallChange,
    changes,
    summary
  };
}

/**
 * Generates a quality report as formatted text
 *
 * @param brief - The brief to report on
 * @returns Formatted quality report
 */
export function generateQualityReport(brief: GenericBrief): string {
  const score = scoreBrief(brief);

  const lines: string[] = [];

  lines.push('=== BRIEF QUALITY REPORT ===\n');

  // Overall assessment
  lines.push(`Overall Score: ${score.overallScore}/100`);
  lines.push(`Status: ${score.needsRevision ? '⚠️  NEEDS REVISION' : '✅ READY'}`);
  lines.push(`Confidence: ${score.confidence}%\n`);

  // Dimension scores
  lines.push('--- Quality Dimensions ---');
  lines.push(`Completeness:  ${score.completeness}/100 ${getScoreEmoji(score.completeness)}`);
  lines.push(`Clarity:       ${score.clarity}/100 ${getScoreEmoji(score.clarity)}`);
  lines.push(`Specificity:   ${score.specificity}/100 ${getScoreEmoji(score.specificity)}`);
  lines.push(`Actionability: ${score.actionability}/100 ${getScoreEmoji(score.actionability)}\n`);

  // Issues
  if (score.issueSummary.total > 0) {
    lines.push('--- Issues Found ---');
    if (score.issueSummary.critical > 0) {
      lines.push(`🔴 Critical: ${score.issueSummary.critical}`);
    }
    if (score.issueSummary.moderate > 0) {
      lines.push(`🟡 Moderate: ${score.issueSummary.moderate}`);
    }
    if (score.issueSummary.minor > 0) {
      lines.push(`🔵 Minor: ${score.issueSummary.minor}`);
    }
    lines.push('');
  }

  // Strengths
  if (score.strengths.length > 0) {
    lines.push('--- Strengths ---');
    score.strengths.forEach(s => lines.push(`✓ ${s}`));
    lines.push('');
  }

  // Suggestions
  if (score.suggestions.length > 0) {
    lines.push('--- Suggestions for Improvement ---');
    score.suggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }

  return lines.join('\n');
}

/**
 * Helper to get emoji for score
 */
function getScoreEmoji(score: number): string {
  if (score >= 85) return '🟢';
  if (score >= 70) return '🟡';
  return '🔴';
}
