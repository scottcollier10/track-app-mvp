/**
 * Brief Normalization System
 *
 * A reusable schema and normalization system for converting messy briefs
 * into structured data with quality scoring. Extracted from Content Ops Copilot
 * and generalized for multiple domains.
 *
 * @module schemas
 *
 * @example
 * ```typescript
 * import { normalizeBrief, scoreBrief } from '@/lib/schemas';
 *
 * const result = await normalizeBrief(rawInput, 'marketing', llmClient);
 * const quality = scoreBrief(result.brief);
 *
 * if (quality.needsRevision) {
 *   console.log('Suggestions:', quality.suggestions);
 * }
 * ```
 */

// Core schema
export type {
  GenericBrief,
  BriefType,
  BriefIssue,
  BriefDeliverable,
  BriefNormalizationResult,
  IssueSeverity
} from './brief-schema';

export {
  isGenericBrief,
  calculateOverallQuality,
  needsRevision
} from './brief-schema';

// Parser and validator
export type {
  NormalizationOptions,
  LLMClient
} from './brief-parser';

export {
  normalizeBrief,
  normalizeBriefs,
  quickValidate,
  validateBriefSchema,
  parseLLMResponse,
  MockLLMClient
} from './brief-parser';

// Prompt templates
export type {
  PromptOptions
} from './brief-normalization-prompt';

export {
  buildBriefNormalizationPrompt,
  buildQuickValidationPrompt,
  buildImprovementPrompt
} from './brief-normalization-prompt';

// Quality scoring
export type {
  BriefQualityScore
} from './brief-quality-scorer';

export {
  scoreBrief,
  calculateActionability,
  compareBriefQuality,
  generateQualityReport
} from './brief-quality-scorer';

// Domain-specific variants
export type {
  MarketingBrief,
  MarketingChannel,
  ToneOfVoice,
  MarketingDeliverable
} from './variants/marketing-brief';

export {
  isMarketingBrief,
  validateMarketingBrief,
  calculateCampaignComplexity,
  createMarketingBriefTemplate
} from './variants/marketing-brief';

export type {
  JobBrief,
  ExperienceLevel,
  EmploymentType,
  LocationType,
  SkillRequirement,
  Compensation
} from './variants/job-brief';

export {
  isJobBrief,
  validateJobBrief,
  calculateSeniorityScore,
  extractKeyRequirements,
  estimateTimeToHire,
  createJobBriefTemplate
} from './variants/job-brief';

export type {
  FeatureBrief,
  FeaturePriority,
  FeatureCategory,
  EffortEstimate,
  UserStory,
  AcceptanceCriteria,
  TechnicalRequirement,
  FeatureDependency
} from './variants/feature-brief';

export {
  isFeatureBrief,
  validateFeatureBrief,
  calculateFeatureComplexity,
  calculateFeatureValue,
  calculatePriorityScore,
  extractImplementationChecklist,
  createFeatureBriefTemplate
} from './variants/feature-brief';
