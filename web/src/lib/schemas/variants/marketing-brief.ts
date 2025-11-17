/**
 * Marketing Brief Variant
 *
 * Domain-specific extension of GenericBrief for marketing and content campaigns.
 * Inspired by Content Ops Copilot workflows.
 *
 * @module variants/marketing-brief
 */

import type { GenericBrief, BriefDeliverable } from '../brief-schema';

/**
 * Marketing channel types
 */
export type MarketingChannel =
  | 'blog'
  | 'social-media'
  | 'email'
  | 'paid-ads'
  | 'video'
  | 'podcast'
  | 'webinar'
  | 'events'
  | 'pr'
  | 'partnerships'
  | 'other';

/**
 * Tone of voice options
 */
export type ToneOfVoice =
  | 'professional'
  | 'casual'
  | 'friendly'
  | 'authoritative'
  | 'playful'
  | 'inspirational'
  | 'educational';

/**
 * Marketing deliverable with additional marketing-specific fields
 */
export interface MarketingDeliverable extends BriefDeliverable {
  /** Marketing channel for this deliverable */
  channel?: MarketingChannel;
  /** Word count for written content */
  wordCount?: number;
  /** Duration for video/audio content (in minutes) */
  duration?: number;
  /** Specific format requirements */
  format?: string;
}

/**
 * Marketing-specific brief extending the generic brief schema
 *
 * @example
 * ```typescript
 * const brief: MarketingBrief = {
 *   // ... all GenericBrief fields
 *   type: 'marketing',
 *   campaignObjective: 'Generate leads for Q4 product launch',
 *   channels: ['blog', 'social-media', 'email'],
 *   keyMessages: ['Innovation', 'Ease of use', '10x productivity'],
 *   toneOfVoice: 'professional',
 *   budget: 50000,
 *   brandGuidelines: 'https://brand.example.com/guidelines'
 * };
 * ```
 */
export interface MarketingBrief extends Omit<GenericBrief, 'type' | 'deliverables'> {
  /** Brief type (always 'marketing') */
  type: 'marketing';

  // ============================================================
  // MARKETING-SPECIFIC FIELDS
  // ============================================================

  /** Primary objective of the campaign */
  campaignObjective?: string;

  /** Marketing channels to be used */
  channels?: MarketingChannel[];

  /** Key messages or themes to communicate */
  keyMessages?: string[];

  /** Desired tone of voice */
  toneOfVoice?: ToneOfVoice;

  /** Budget in USD (or specify currency) */
  budget?: number;

  /** Currency code (default: USD) */
  currency?: string;

  /** Timeline for the campaign */
  timeline?: {
    startDate?: string;
    endDate?: string;
    milestones?: Array<{
      date: string;
      description: string;
    }>;
  };

  /** Brand guidelines URL or description */
  brandGuidelines?: string;

  /** Competitor information */
  competitors?: string[];

  /** SEO keywords (for content campaigns) */
  seoKeywords?: string[];

  /** Call-to-action (CTA) */
  cta?: string;

  /** Campaign success metrics */
  kpis?: Array<{
    metric: string;
    target: string | number;
  }>;

  /** Marketing deliverables with channel info */
  deliverables?: MarketingDeliverable[];
}

/**
 * Type guard for MarketingBrief
 */
export function isMarketingBrief(brief: GenericBrief): brief is MarketingBrief {
  return brief.type === 'marketing';
}

/**
 * Helper to validate marketing-specific fields
 */
export function validateMarketingBrief(brief: MarketingBrief): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for critical marketing fields
  if (!brief.campaignObjective && !brief.goals?.length) {
    warnings.push('No campaign objective or goals specified');
  }

  if (!brief.channels || brief.channels.length === 0) {
    warnings.push('No marketing channels specified');
  }

  if (!brief.targetAudience) {
    warnings.push('Target audience not specified');
  }

  if (!brief.keyMessages || brief.keyMessages.length === 0) {
    warnings.push('No key messages defined');
  }

  if (!brief.deliverables || brief.deliverables.length === 0) {
    warnings.push('No deliverables specified');
  }

  if (brief.budget && brief.budget < 0) {
    warnings.push('Budget cannot be negative');
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * Helper to calculate campaign complexity score
 */
export function calculateCampaignComplexity(brief: MarketingBrief): {
  score: number; // 1-5
  factors: string[];
} {
  let score = 1;
  const factors: string[] = [];

  // Multiple channels add complexity
  const channelCount = brief.channels?.length || 0;
  if (channelCount > 3) {
    score += 1;
    factors.push(`${channelCount} channels`);
  }

  // Multiple deliverables add complexity
  const deliverableCount = brief.deliverables?.length || 0;
  if (deliverableCount > 5) {
    score += 1;
    factors.push(`${deliverableCount} deliverables`);
  }

  // Multiple messages add complexity
  const messageCount = brief.keyMessages?.length || 0;
  if (messageCount > 5) {
    score += 0.5;
    factors.push(`${messageCount} key messages`);
  }

  // Long timeline adds complexity
  if (brief.timeline?.startDate && brief.timeline?.endDate) {
    const start = new Date(brief.timeline.startDate);
    const end = new Date(brief.timeline.endDate);
    const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 90) {
      score += 1;
      factors.push(`${Math.round(durationDays)} day campaign`);
    }
  }

  // Many constraints add complexity
  const constraintCount = brief.constraints?.length || 0;
  if (constraintCount > 5) {
    score += 0.5;
    factors.push(`${constraintCount} constraints`);
  }

  return {
    score: Math.min(5, Math.round(score * 10) / 10),
    factors
  };
}

/**
 * Default marketing brief template
 */
export function createMarketingBriefTemplate(): Partial<MarketingBrief> {
  return {
    type: 'marketing',
    title: '',
    description: '',
    campaignObjective: '',
    channels: [],
    keyMessages: [],
    targetAudience: '',
    goals: [],
    deliverables: [],
    constraints: [],
    completeness: 0,
    clarity: 0,
    specificity: 0,
    issues: [],
    rawInput: '',
    normalizedAt: new Date()
  };
}
