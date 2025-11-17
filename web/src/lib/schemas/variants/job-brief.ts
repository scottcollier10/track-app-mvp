/**
 * Job Brief Variant
 *
 * Domain-specific extension of GenericBrief for job descriptions and hiring briefs.
 * Useful for JobBot and recruiting workflows.
 *
 * @module variants/job-brief
 */

import type { GenericBrief } from '../brief-schema';

/**
 * Experience level for the role
 */
export type ExperienceLevel =
  | 'entry'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'executive';

/**
 * Employment type
 */
export type EmploymentType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'temporary'
  | 'internship'
  | 'freelance';

/**
 * Work location type
 */
export type LocationType =
  | 'remote'
  | 'hybrid'
  | 'on-site';

/**
 * Skill requirement with proficiency level
 */
export interface SkillRequirement {
  /** Skill name (e.g., 'React', 'Python', 'Project Management') */
  skill: string;
  /** Is this skill required or nice-to-have? */
  required: boolean;
  /** Years of experience desired */
  yearsExperience?: number;
  /** Proficiency level */
  proficiency?: 'basic' | 'intermediate' | 'advanced' | 'expert';
}

/**
 * Compensation details
 */
export interface Compensation {
  /** Salary range minimum */
  salaryMin?: number;
  /** Salary range maximum */
  salaryMax?: number;
  /** Currency code (default: USD) */
  currency?: string;
  /** Compensation period */
  period?: 'hourly' | 'annually' | 'monthly';
  /** Additional benefits */
  benefits?: string[];
  /** Equity/stock options */
  equity?: string;
  /** Bonus structure */
  bonus?: string;
}

/**
 * Job-specific brief extending the generic brief schema
 *
 * @example
 * ```typescript
 * const brief: JobBrief = {
 *   // ... all GenericBrief fields
 *   type: 'job',
 *   roleTitle: 'Senior Frontend Engineer',
 *   department: 'Engineering',
 *   experienceLevel: 'senior',
 *   employmentType: 'full-time',
 *   locationType: 'remote',
 *   skills: [
 *     { skill: 'React', required: true, yearsExperience: 5 },
 *     { skill: 'TypeScript', required: true, yearsExperience: 3 }
 *   ],
 *   compensation: {
 *     salaryMin: 120000,
 *     salaryMax: 180000,
 *     currency: 'USD',
 *     period: 'annually'
 *   }
 * };
 * ```
 */
export interface JobBrief extends Omit<GenericBrief, 'type'> {
  /** Brief type (always 'job') */
  type: 'job';

  // ============================================================
  // JOB-SPECIFIC FIELDS
  // ============================================================

  /** Job title */
  roleTitle?: string;

  /** Department or team */
  department?: string;

  /** Experience level required */
  experienceLevel?: ExperienceLevel;

  /** Type of employment */
  employmentType?: EmploymentType;

  /** Work location type */
  locationType?: LocationType;

  /** Specific office location(s) if applicable */
  locations?: string[];

  /** Key responsibilities or duties */
  responsibilities?: string[];

  /** Required and preferred skills */
  skills?: SkillRequirement[];

  /** Required education or certifications */
  education?: string[];

  /** Compensation details */
  compensation?: Compensation;

  /** Team size and structure */
  team?: {
    size?: number;
    structure?: string;
    reportsTo?: string;
    manages?: number;
  };

  /** Company information */
  company?: {
    name?: string;
    industry?: string;
    size?: string;
    stage?: 'startup' | 'growth' | 'enterprise';
    description?: string;
  };

  /** Hiring process details */
  hiringProcess?: Array<{
    stage: string;
    description?: string;
    duration?: string;
  }>;

  /** Start date */
  startDate?: string;

  /** Application deadline */
  applicationDeadline?: string;

  /** Visa sponsorship available? */
  visaSponsorship?: boolean;

  /** Remote work restrictions (e.g., timezone requirements) */
  remoteRestrictions?: string[];
}

/**
 * Type guard for JobBrief
 */
export function isJobBrief(brief: GenericBrief): brief is JobBrief {
  return brief.type === 'job';
}

/**
 * Helper to validate job-specific fields
 */
export function validateJobBrief(brief: JobBrief): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for critical job fields
  if (!brief.roleTitle) {
    warnings.push('Role title not specified');
  }

  if (!brief.responsibilities || brief.responsibilities.length === 0) {
    warnings.push('No responsibilities listed');
  }

  if (!brief.skills || brief.skills.length === 0) {
    warnings.push('No skills specified');
  }

  if (!brief.experienceLevel) {
    warnings.push('Experience level not specified');
  }

  if (!brief.employmentType) {
    warnings.push('Employment type not specified');
  }

  if (!brief.locationType) {
    warnings.push('Location type not specified');
  }

  if (!brief.compensation) {
    warnings.push('No compensation information provided');
  } else {
    if (!brief.compensation.salaryMin && !brief.compensation.salaryMax) {
      warnings.push('Salary range not specified');
    }
    if (brief.compensation.salaryMin && brief.compensation.salaryMax &&
        brief.compensation.salaryMin > brief.compensation.salaryMax) {
      warnings.push('Salary minimum is greater than maximum');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * Helper to calculate role seniority score (1-5)
 */
export function calculateSeniorityScore(brief: JobBrief): number {
  const experienceLevels: Record<ExperienceLevel, number> = {
    entry: 1,
    mid: 2,
    senior: 3,
    lead: 4,
    principal: 4.5,
    executive: 5
  };

  let score = experienceLevels[brief.experienceLevel || 'mid'];

  // Adjust based on team management
  if (brief.team?.manages && brief.team.manages > 0) {
    score = Math.min(5, score + 0.5);
  }

  // Adjust based on required skills complexity
  const requiredSkillsCount = brief.skills?.filter(s => s.required).length || 0;
  if (requiredSkillsCount > 10) {
    score = Math.min(5, score + 0.5);
  }

  return Math.round(score * 10) / 10;
}

/**
 * Helper to extract key requirements summary
 */
export function extractKeyRequirements(brief: JobBrief): {
  mustHave: string[];
  niceToHave: string[];
  dealBreakers: string[];
} {
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  const dealBreakers: string[] = [];

  // Extract from skills
  brief.skills?.forEach(skill => {
    if (skill.required) {
      mustHave.push(`${skill.skill}${skill.yearsExperience ? ` (${skill.yearsExperience}+ years)` : ''}`);
    } else {
      niceToHave.push(skill.skill);
    }
  });

  // Extract from education
  brief.education?.forEach(edu => {
    if (edu.toLowerCase().includes('required')) {
      mustHave.push(edu);
    } else {
      niceToHave.push(edu);
    }
  });

  // Extract from location constraints
  if (brief.locationType === 'on-site' && brief.locations) {
    dealBreakers.push(`Must be in ${brief.locations.join(' or ')}`);
  }

  if (brief.remoteRestrictions && brief.remoteRestrictions.length > 0) {
    dealBreakers.push(...brief.remoteRestrictions);
  }

  // Extract from visa sponsorship
  if (brief.visaSponsorship === false) {
    dealBreakers.push('No visa sponsorship available');
  }

  return { mustHave, niceToHave, dealBreakers };
}

/**
 * Helper to estimate time-to-hire based on role complexity
 */
export function estimateTimeToHire(brief: JobBrief): {
  weeks: number;
  factors: string[];
} {
  let weeks = 4; // Base time
  const factors: string[] = [];

  // Seniority adds time
  const seniorityScore = calculateSeniorityScore(brief);
  if (seniorityScore >= 4) {
    weeks += 4;
    factors.push('Senior role requires more thorough evaluation');
  } else if (seniorityScore >= 3) {
    weeks += 2;
    factors.push('Mid-senior role');
  }

  // Many required skills adds time
  const requiredSkillsCount = brief.skills?.filter(s => s.required).length || 0;
  if (requiredSkillsCount > 10) {
    weeks += 2;
    factors.push('Many required skills = smaller candidate pool');
  }

  // Multiple interview stages add time
  const interviewStages = brief.hiringProcess?.length || 3;
  if (interviewStages > 4) {
    weeks += 2;
    factors.push(`${interviewStages} interview stages`);
  }

  // Location constraints add time
  if (brief.locationType === 'on-site') {
    weeks += 1;
    factors.push('On-site requirement limits candidate pool');
  }

  return {
    weeks: Math.round(weeks),
    factors
  };
}

/**
 * Default job brief template
 */
export function createJobBriefTemplate(): Partial<JobBrief> {
  return {
    type: 'job',
    title: '',
    description: '',
    roleTitle: '',
    department: '',
    responsibilities: [],
    skills: [],
    experienceLevel: 'mid',
    employmentType: 'full-time',
    locationType: 'remote',
    compensation: {
      currency: 'USD',
      period: 'annually'
    },
    completeness: 0,
    clarity: 0,
    specificity: 0,
    issues: [],
    rawInput: '',
    normalizedAt: new Date()
  };
}
