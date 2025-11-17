/**
 * Feature Brief Variant
 *
 * Domain-specific extension of GenericBrief for product features and enhancements.
 * Useful for Track App feature requests and product planning.
 *
 * @module variants/feature-brief
 */

import type { GenericBrief } from '../brief-schema';

/**
 * Feature priority level
 */
export type FeaturePriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

/**
 * Feature category or type
 */
export type FeatureCategory =
  | 'new-feature'
  | 'enhancement'
  | 'bug-fix'
  | 'performance'
  | 'ui-ux'
  | 'api'
  | 'integration'
  | 'security'
  | 'technical-debt';

/**
 * Implementation effort estimate
 */
export type EffortEstimate =
  | 'trivial'      // < 1 day
  | 'small'        // 1-3 days
  | 'medium'       // 1-2 weeks
  | 'large'        // 2-4 weeks
  | 'xlarge';      // 1+ months

/**
 * User story format
 */
export interface UserStory {
  /** As a [role/persona] */
  persona: string;
  /** I want to [action] */
  action: string;
  /** So that [benefit] */
  benefit: string;
}

/**
 * Acceptance criteria
 */
export interface AcceptanceCriteria {
  /** Criterion description */
  description: string;
  /** Is this criterion testable? */
  testable: boolean;
  /** Optional: How to test this */
  testInstructions?: string;
}

/**
 * Technical requirement or constraint
 */
export interface TechnicalRequirement {
  /** Requirement description */
  description: string;
  /** Category (e.g., 'performance', 'security', 'compatibility') */
  category: string;
  /** Is this a hard requirement? */
  mandatory: boolean;
}

/**
 * Feature dependency
 */
export interface FeatureDependency {
  /** What this feature depends on */
  dependsOn: string;
  /** Type of dependency */
  type: 'blocks' | 'requires' | 'related';
  /** Additional context */
  notes?: string;
}

/**
 * Feature-specific brief extending the generic brief schema
 *
 * @example
 * ```typescript
 * const brief: FeatureBrief = {
 *   // ... all GenericBrief fields
 *   type: 'product',
 *   featureCategory: 'new-feature',
 *   priority: 'high',
 *   userProblem: 'Users cannot export their session data',
 *   proposedSolution: 'Add CSV/JSON export functionality',
 *   userStory: {
 *     persona: 'Track App user',
 *     action: 'export my session history',
 *     benefit: 'I can analyze my data in Excel'
 *   },
 *   acceptanceCriteria: [
 *     {
 *       description: 'Users can export data as CSV',
 *       testable: true
 *     }
 *   ],
 *   effortEstimate: 'small'
 * };
 * ```
 */
export interface FeatureBrief extends Omit<GenericBrief, 'type'> {
  /** Brief type (always 'product') */
  type: 'product';

  // ============================================================
  // FEATURE-SPECIFIC FIELDS
  // ============================================================

  /** Category of feature request */
  featureCategory?: FeatureCategory;

  /** Priority level */
  priority?: FeaturePriority;

  /** The problem users are experiencing */
  userProblem?: string;

  /** Proposed solution or approach */
  proposedSolution?: string;

  /** Alternative solutions considered */
  alternatives?: string[];

  /** User story format */
  userStory?: UserStory;

  /** Acceptance criteria that must be met */
  acceptanceCriteria?: AcceptanceCriteria[];

  /** Technical requirements and constraints */
  technicalRequirements?: TechnicalRequirement[];

  /** Feature dependencies */
  dependencies?: FeatureDependency[];

  /** Affected user segments */
  affectedUsers?: string[];

  /** Expected impact or metrics */
  expectedImpact?: {
    metric: string;
    current?: string | number;
    target: string | number;
  }[];

  /** Effort estimate */
  effortEstimate?: EffortEstimate;

  /** Design requirements */
  design?: {
    mockups?: string[];
    userFlows?: string[];
    designSystem?: string;
    accessibility?: string[];
  };

  /** Implementation notes */
  implementation?: {
    approach?: string;
    risksAndMitigations?: Array<{
      risk: string;
      mitigation: string;
    }>;
    testingStrategy?: string;
    rolloutPlan?: string;
  };

  /** Stakeholders and decision makers */
  stakeholders?: Array<{
    name: string;
    role: string;
    responsibility: string;
  }>;
}

/**
 * Type guard for FeatureBrief
 */
export function isFeatureBrief(brief: GenericBrief): brief is FeatureBrief {
  return brief.type === 'product';
}

/**
 * Helper to validate feature-specific fields
 */
export function validateFeatureBrief(brief: FeatureBrief): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for critical feature fields
  if (!brief.userProblem) {
    warnings.push('User problem not clearly defined');
  }

  if (!brief.proposedSolution && !brief.description) {
    warnings.push('No solution or description provided');
  }

  if (!brief.acceptanceCriteria || brief.acceptanceCriteria.length === 0) {
    warnings.push('No acceptance criteria defined');
  }

  if (!brief.priority) {
    warnings.push('Priority not set');
  }

  if (!brief.featureCategory) {
    warnings.push('Feature category not specified');
  }

  if (!brief.successCriteria && !brief.expectedImpact) {
    warnings.push('No success criteria or expected impact defined');
  }

  if (!brief.targetAudience && !brief.affectedUsers) {
    warnings.push('Target users not specified');
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * Helper to calculate feature complexity score (1-5)
 */
export function calculateFeatureComplexity(brief: FeatureBrief): {
  score: number;
  factors: string[];
} {
  let score = 1;
  const factors: string[] = [];

  // Effort estimate contributes to complexity
  const effortScores: Record<EffortEstimate, number> = {
    trivial: 0,
    small: 0.5,
    medium: 1,
    large: 2,
    xlarge: 3
  };
  if (brief.effortEstimate) {
    score += effortScores[brief.effortEstimate];
    factors.push(`${brief.effortEstimate} effort estimate`);
  }

  // Dependencies add complexity
  const depCount = brief.dependencies?.length || 0;
  if (depCount > 0) {
    score += depCount * 0.5;
    factors.push(`${depCount} dependencies`);
  }

  // Technical requirements add complexity
  const techReqCount = brief.technicalRequirements?.filter(r => r.mandatory).length || 0;
  if (techReqCount > 3) {
    score += 1;
    factors.push(`${techReqCount} technical requirements`);
  }

  // Multiple user segments add complexity
  const userSegmentCount = brief.affectedUsers?.length || 0;
  if (userSegmentCount > 2) {
    score += 0.5;
    factors.push(`${userSegmentCount} user segments`);
  }

  // Implementation risks add complexity
  const riskCount = brief.implementation?.risksAndMitigations?.length || 0;
  if (riskCount > 2) {
    score += 0.5;
    factors.push(`${riskCount} identified risks`);
  }

  return {
    score: Math.min(5, Math.round(score * 10) / 10),
    factors
  };
}

/**
 * Helper to calculate feature value score (1-5)
 */
export function calculateFeatureValue(brief: FeatureBrief): {
  score: number;
  factors: string[];
} {
  let score = 1;
  const factors: string[] = [];

  // Priority indicates value
  const priorityScores: Record<FeaturePriority, number> = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0
  };
  if (brief.priority) {
    score += priorityScores[brief.priority];
    factors.push(`${brief.priority} priority`);
  }

  // Expected impact indicates value
  const impactCount = brief.expectedImpact?.length || 0;
  if (impactCount > 0) {
    score += Math.min(1, impactCount * 0.3);
    factors.push(`${impactCount} expected impacts`);
  }

  // User reach indicates value
  const affectedUserCount = brief.affectedUsers?.length || 0;
  if (affectedUserCount > 2) {
    score += 0.5;
    factors.push(`Affects ${affectedUserCount} user segments`);
  }

  // Strategic goals indicate value
  const goalCount = brief.goals?.length || 0;
  if (goalCount > 0) {
    score += Math.min(0.5, goalCount * 0.2);
    factors.push(`Supports ${goalCount} goals`);
  }

  return {
    score: Math.min(5, Math.round(score * 10) / 10),
    factors
  };
}

/**
 * Helper to calculate priority score based on value and complexity
 * Higher score = should be prioritized
 */
export function calculatePriorityScore(brief: FeatureBrief): {
  score: number;
  recommendation: string;
} {
  const value = calculateFeatureValue(brief);
  const complexity = calculateFeatureComplexity(brief);

  // Priority score = value / complexity
  // High value, low complexity = highest priority
  const score = complexity.score > 0 ? value.score / complexity.score : value.score;

  let recommendation: string;
  if (score >= 2) {
    recommendation = 'High priority - quick win with high value';
  } else if (score >= 1) {
    recommendation = 'Medium priority - good value for effort';
  } else if (score >= 0.5) {
    recommendation = 'Low priority - consider if capacity allows';
  } else {
    recommendation = 'Very low priority - high effort, low value';
  }

  return {
    score: Math.round(score * 100) / 100,
    recommendation
  };
}

/**
 * Helper to extract implementation checklist
 */
export function extractImplementationChecklist(brief: FeatureBrief): string[] {
  const checklist: string[] = [];

  // Add acceptance criteria
  brief.acceptanceCriteria?.forEach(ac => {
    checklist.push(`✓ ${ac.description}`);
  });

  // Add technical requirements
  brief.technicalRequirements?.filter(tr => tr.mandatory).forEach(tr => {
    checklist.push(`✓ ${tr.description}`);
  });

  // Add design requirements
  if (brief.design?.mockups && brief.design.mockups.length > 0) {
    checklist.push('✓ Complete design mockups');
  }
  if (brief.design?.userFlows && brief.design.userFlows.length > 0) {
    checklist.push('✓ Document user flows');
  }

  // Add testing
  if (brief.implementation?.testingStrategy) {
    checklist.push('✓ Execute testing strategy');
  } else {
    checklist.push('✓ Create and run tests');
  }

  // Add rollout
  if (brief.implementation?.rolloutPlan) {
    checklist.push('✓ Follow rollout plan');
  }

  return checklist;
}

/**
 * Default feature brief template
 */
export function createFeatureBriefTemplate(): Partial<FeatureBrief> {
  return {
    type: 'product',
    title: '',
    description: '',
    featureCategory: 'new-feature',
    priority: 'medium',
    userProblem: '',
    proposedSolution: '',
    acceptanceCriteria: [],
    technicalRequirements: [],
    dependencies: [],
    completeness: 0,
    clarity: 0,
    specificity: 0,
    issues: [],
    rawInput: '',
    normalizedAt: new Date()
  };
}
