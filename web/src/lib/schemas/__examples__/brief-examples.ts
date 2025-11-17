/**
 * Brief Normalization Examples
 *
 * Real-world examples showing how to use the brief normalization system
 * for different domains: marketing, job descriptions, and feature requests.
 *
 * @module __examples__/brief-examples
 */

import {
  normalizeBrief,
  MockLLMClient,
  type LLMClient
} from '../brief-parser';
import {
  scoreBrief,
  generateQualityReport
} from '../brief-quality-scorer';
import type { MarketingBrief } from '../variants/marketing-brief';
import type { JobBrief } from '../variants/job-brief';
import type { FeatureBrief } from '../variants/feature-brief';

// ============================================================
// EXAMPLE 1: Normalize a messy marketing brief
// ============================================================

/**
 * Example: Marketing brief for a content campaign
 *
 * Shows how to take messy, unstructured text and normalize it into
 * a structured MarketingBrief with quality scoring.
 */
export async function example1_normalizeMarketingBrief() {
  console.log('=== EXAMPLE 1: Marketing Brief Normalization ===\n');

  // Raw, messy input from a stakeholder
  const rawInput = `
    need 3 blog posts about AI for developers
    target: software engineers who want to learn about AI/ML
    due next month
    should be technical but accessible
    we want to position ourselves as thought leaders
    budget is around $3000
    posts should be 1500-2000 words each
    SEO keywords: AI development, machine learning tutorial, neural networks
    competitor: TechCrunch AI section
  `;

  // Create LLM client (use MockLLMClient for demo, replace with real client)
  const llmClient: LLMClient = new MockLLMClient();

  console.log('Raw Input:');
  console.log(rawInput);
  console.log('\n--- Normalizing... ---\n');

  // Normalize the brief
  const result = await normalizeBrief(
    rawInput,
    'marketing',
    llmClient,
    {
      strictMode: true,
      includeSuggestions: true
    }
  );

  console.log('Normalized Brief:');
  console.log(JSON.stringify(result.brief, null, 2));

  console.log('\n--- Quality Assessment ---');
  console.log(`Overall Quality: ${result.qualityScore}/100`);
  console.log(`Needs Revision: ${result.needsRevision ? 'Yes' : 'No'}`);
  console.log(`Confidence: ${result.confidence}%`);

  // Generate detailed quality report
  const qualityScore = scoreBrief(result.brief);
  console.log('\n' + generateQualityReport(result.brief));

  // Type assertion for domain-specific features
  const marketingBrief = result.brief as MarketingBrief;
  if (marketingBrief.channels) {
    console.log('\nChannels:', marketingBrief.channels);
  }
  if (marketingBrief.seoKeywords) {
    console.log('SEO Keywords:', marketingBrief.seoKeywords);
  }

  return result;
}

// ============================================================
// EXAMPLE 2: Normalize a job description
// ============================================================

/**
 * Example: Job description for a software engineering role
 *
 * Shows how to structure hiring briefs with skills, compensation, etc.
 */
export async function example2_normalizeJobBrief() {
  console.log('=== EXAMPLE 2: Job Brief Normalization ===\n');

  // Raw job posting text
  const rawInput = `
    Hiring senior frontend engineer, React/TypeScript required
    Remote work OK but prefer SF Bay Area
    Looking for 5+ years experience
    Need someone who can lead projects and mentor juniors
    Salary range: $120k-180k depending on experience
    We're a Series B startup, 50 people, building B2B SaaS
    Must have: React, TypeScript, testing experience
    Nice to have: Next.js, GraphQL, design system experience
    Team is 10 engineers, you'd report to VP Engineering
    Interview process: recruiter call, tech screen, onsite (4 hours), references
    Start ASAP
  `;

  const llmClient: LLMClient = new MockLLMClient();

  console.log('Raw Input:');
  console.log(rawInput);
  console.log('\n--- Normalizing... ---\n');

  // Normalize the brief
  const result = await normalizeBrief(
    rawInput,
    'job',
    llmClient,
    {
      strictMode: false,
      qualityThreshold: 60
    }
  );

  console.log('Normalized Brief:');
  console.log(JSON.stringify(result.brief, null, 2));

  console.log('\n--- Quality Assessment ---');
  const qualityScore = scoreBrief(result.brief);
  console.log(generateQualityReport(result.brief));

  // Type assertion for job-specific features
  const jobBrief = result.brief as JobBrief;
  if (jobBrief.skills) {
    console.log('\nRequired Skills:');
    jobBrief.skills
      .filter(s => s.required)
      .forEach(s => console.log(`  - ${s.skill} (${s.yearsExperience || 'unspecified'} years)`));

    console.log('\nPreferred Skills:');
    jobBrief.skills
      .filter(s => !s.required)
      .forEach(s => console.log(`  - ${s.skill}`));
  }

  if (jobBrief.compensation) {
    console.log('\nCompensation:');
    console.log(`  $${jobBrief.compensation.salaryMin?.toLocaleString()} - $${jobBrief.compensation.salaryMax?.toLocaleString()} ${jobBrief.compensation.period}`);
  }

  return result;
}

// ============================================================
// EXAMPLE 3: Normalize a feature request
// ============================================================

/**
 * Example: Feature request for Track App
 *
 * Shows how to structure product feature briefs with acceptance criteria,
 * user stories, and implementation details.
 */
export async function example3_normalizeFeatureBrief() {
  console.log('=== EXAMPLE 3: Feature Brief Normalization ===\n');

  // Raw feature request from a user or stakeholder
  const rawInput = `
    Users are asking for CSV export of their session data
    Problem: people want to analyze data in Excel or share with coaches
    Should export: date, track name, session duration, best lap time, avg speed
    Need it by end of quarter for our big partnership announcement
    Could also export as JSON for developers
    Must work on mobile and web
    Should handle large datasets (1000+ sessions)
    Low priority but users keep asking
    Similar to what Strava does
  `;

  const llmClient: LLMClient = new MockLLMClient();

  console.log('Raw Input:');
  console.log(rawInput);
  console.log('\n--- Normalizing... ---\n');

  // Normalize the brief
  const result = await normalizeBrief(
    rawInput,
    'product',
    llmClient,
    {
      strictMode: true,
      includeSuggestions: true,
      customInstructions: 'This is for Track App, a motorsport tracking application'
    }
  );

  console.log('Normalized Brief:');
  console.log(JSON.stringify(result.brief, null, 2));

  console.log('\n--- Quality Assessment ---');
  const qualityScore = scoreBrief(result.brief);
  console.log(generateQualityReport(result.brief));

  // Type assertion for feature-specific features
  const featureBrief = result.brief as FeatureBrief;

  if (featureBrief.userStory) {
    console.log('\nUser Story:');
    console.log(`  As a ${featureBrief.userStory.persona}`);
    console.log(`  I want to ${featureBrief.userStory.action}`);
    console.log(`  So that ${featureBrief.userStory.benefit}`);
  }

  if (featureBrief.acceptanceCriteria && featureBrief.acceptanceCriteria.length > 0) {
    console.log('\nAcceptance Criteria:');
    featureBrief.acceptanceCriteria.forEach((ac, i) => {
      console.log(`  ${i + 1}. ${ac.description}`);
    });
  }

  if (featureBrief.expectedImpact) {
    console.log('\nExpected Impact:');
    featureBrief.expectedImpact.forEach(impact => {
      console.log(`  - ${impact.metric}: ${impact.current || '?'} → ${impact.target}`);
    });
  }

  return result;
}

// ============================================================
// EXAMPLE 4: Batch processing multiple briefs
// ============================================================

/**
 * Example: Process multiple briefs at once
 *
 * Useful for intake forms, survey responses, or bulk processing.
 */
export async function example4_batchProcessBriefs() {
  console.log('=== EXAMPLE 4: Batch Brief Processing ===\n');

  const rawBriefs = [
    'Need landing page redesign, modern look, mobile-first, by next Friday',
    'Hiring data analyst, SQL required, remote OK, $80k-100k',
    'Add dark mode to the app, users complaining about eye strain'
  ];

  const llmClient: LLMClient = new MockLLMClient();

  console.log(`Processing ${rawBriefs.length} briefs...\n`);

  const results = await Promise.all(
    rawBriefs.map((raw, i) => {
      // Determine brief type (in real app, you'd detect this)
      const types: ('marketing' | 'job' | 'product')[] = ['marketing', 'job', 'product'];
      return normalizeBrief(raw, types[i], llmClient);
    })
  );

  results.forEach((result, i) => {
    console.log(`Brief ${i + 1}:`);
    console.log(`  Title: ${result.brief.title}`);
    console.log(`  Quality: ${result.qualityScore}/100`);
    console.log(`  Needs Revision: ${result.needsRevision ? 'Yes' : 'No'}`);
    console.log(`  Issues: ${result.brief.issues.length}`);
    console.log('');
  });

  return results;
}

// ============================================================
// EXAMPLE 5: Quality comparison before/after revision
// ============================================================

/**
 * Example: Compare quality before and after revision
 *
 * Shows how quality scoring can track improvements.
 */
export async function example5_qualityComparison() {
  console.log('=== EXAMPLE 5: Quality Comparison ===\n');

  const llmClient: LLMClient = new MockLLMClient();

  // Initial vague brief
  const vagueInput = 'need some blog posts about AI';

  console.log('Original (vague) brief:');
  console.log(vagueInput);
  console.log('');

  const before = await normalizeBrief(vagueInput, 'marketing', llmClient);

  console.log('Quality score:', before.qualityScore);
  console.log('Issues found:', before.brief.issues.length);
  console.log('');

  // Revised, detailed brief
  const detailedInput = `
    Need 3 technical blog posts about AI development for software engineers.
    Target audience: Mid-level developers (3-5 years exp) interested in adding AI to their toolkit.
    Topics: 1) Intro to neural networks, 2) Training your first model, 3) Deploying ML models.
    Each post should be 1500-2000 words, include code examples in Python.
    Due dates: Post 1 by June 15, Post 2 by June 30, Post 3 by July 15.
    Goal: Generate 500 qualified leads for our AI development course.
    Budget: $3000 total ($1000 per post).
    SEO keywords: AI development, machine learning tutorial, neural networks for developers.
    Success metrics: 10,000 views per post, 5% conversion to email list.
  `;

  console.log('Revised (detailed) brief:');
  console.log(detailedInput);
  console.log('');

  const after = await normalizeBrief(detailedInput, 'marketing', llmClient);

  console.log('Quality score:', after.qualityScore);
  console.log('Issues found:', after.brief.issues.length);
  console.log('');

  // Compare
  console.log('--- Comparison ---');
  console.log(`Quality improvement: +${after.qualityScore - before.qualityScore} points`);
  console.log(`Issues resolved: ${before.brief.issues.length - after.brief.issues.length}`);

  return { before, after };
}

// ============================================================
// HELPER: Run all examples
// ============================================================

/**
 * Run all examples in sequence
 */
export async function runAllExamples() {
  console.log('\n'.repeat(2));
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         BRIEF NORMALIZATION SYSTEM - EXAMPLES              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    await example1_normalizeMarketingBrief();
    console.log('\n' + '─'.repeat(60) + '\n');

    await example2_normalizeJobBrief();
    console.log('\n' + '─'.repeat(60) + '\n');

    await example3_normalizeFeatureBrief();
    console.log('\n' + '─'.repeat(60) + '\n');

    await example4_batchProcessBriefs();
    console.log('\n' + '─'.repeat(60) + '\n');

    await example5_qualityComparison();

    console.log('\n' + '═'.repeat(60));
    console.log('All examples completed successfully!');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// ============================================================
// USAGE INSTRUCTIONS
// ============================================================

/**
 * To run these examples:
 *
 * 1. With MockLLMClient (no real API calls):
 *    ```typescript
 *    import { runAllExamples } from './brief-examples';
 *    await runAllExamples();
 *    ```
 *
 * 2. With real LLM client:
 *    ```typescript
 *    import { normalizeBrief } from '../brief-parser';
 *    import { OpenAIClient } from './your-openai-client';
 *
 *    const client = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
 *    const result = await normalizeBrief(rawInput, 'marketing', client);
 *    ```
 *
 * 3. Integrating with your app:
 *    ```typescript
 *    // In your API route or form handler
 *    import { normalizeBrief } from '@/lib/schemas/brief-parser';
 *    import { scoreBrief } from '@/lib/schemas/brief-quality-scorer';
 *
 *    export async function POST(req: Request) {
 *      const { rawInput, briefType } = await req.json();
 *
 *      const result = await normalizeBrief(rawInput, briefType, llmClient);
 *      const quality = scoreBrief(result.brief);
 *
 *      if (quality.needsRevision) {
 *        return Response.json({
 *          status: 'needs_revision',
 *          suggestions: quality.suggestions
 *        });
 *      }
 *
 *      // Store normalized brief in database
 *      await db.briefs.create({ data: result.brief });
 *
 *      return Response.json({ status: 'success', brief: result.brief });
 *    }
 *    ```
 */

// Export all examples for easy testing
export const examples = {
  example1_normalizeMarketingBrief,
  example2_normalizeJobBrief,
  example3_normalizeFeatureBrief,
  example4_batchProcessBriefs,
  example5_qualityComparison,
  runAllExamples
};
