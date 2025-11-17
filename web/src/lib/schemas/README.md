# Brief Normalization System

A reusable schema and normalization system for converting messy, unstructured briefs into clean, structured data with quality scoring.

Extracted from **Content Ops Copilot** W01/W02 workflows and generalized for multiple domains.

## Features

- **Generic Schema**: Flexible `GenericBrief` interface that works across domains
- **LLM-Powered Normalization**: Structured prompts for extracting data from messy text
- **Quality Scoring**: Multi-dimensional quality assessment (completeness, clarity, specificity, actionability)
- **Domain Variants**: Pre-built extensions for marketing, jobs, and product features
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Extensible**: Easy to add new domain-specific variants

## Quick Start

### Basic Usage

```typescript
import { normalizeBrief, scoreBrief, MockLLMClient } from '@/lib/schemas';

// 1. Normalize a messy brief
const rawInput = "need 3 blog posts about AI for developers by next month";
const llmClient = new MockLLMClient(); // Replace with real LLM client

const result = await normalizeBrief(rawInput, 'marketing', llmClient);

// 2. Check quality
const quality = scoreBrief(result.brief);

console.log(`Quality: ${quality.overallScore}/100`);
console.log(`Needs Revision: ${quality.needsRevision}`);

// 3. Act on results
if (quality.needsRevision) {
  console.log('Suggestions:', quality.suggestions);
} else {
  // Store in database, proceed with execution, etc.
}
```

### Domain-Specific Variants

```typescript
import { normalizeBrief } from '@/lib/schemas';
import type { MarketingBrief, JobBrief, FeatureBrief } from '@/lib/schemas';

// Marketing brief
const marketingResult = await normalizeBrief(rawInput, 'marketing', llmClient);
const marketingBrief = marketingResult.brief as MarketingBrief;
console.log('Channels:', marketingBrief.channels);
console.log('Budget:', marketingBrief.budget);

// Job brief
const jobResult = await normalizeBrief(rawInput, 'job', llmClient);
const jobBrief = jobResult.brief as JobBrief;
console.log('Required Skills:', jobBrief.skills?.filter(s => s.required));

// Feature brief
const featureResult = await normalizeBrief(rawInput, 'product', llmClient);
const featureBrief = featureResult.brief as FeatureBrief;
console.log('User Story:', featureBrief.userStory);
console.log('Acceptance Criteria:', featureBrief.acceptanceCriteria);
```

## Architecture

```
schemas/
├── brief-schema.ts                 # Core GenericBrief interface
├── brief-normalization-prompt.ts   # LLM prompt templates
├── brief-parser.ts                 # Normalization logic
├── brief-quality-scorer.ts         # Quality assessment
├── variants/
│   ├── marketing-brief.ts          # Marketing domain extension
│   ├── job-brief.ts                # Job/hiring domain extension
│   └── feature-brief.ts            # Product feature domain extension
├── __examples__/
│   └── brief-examples.ts           # Usage examples
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Core Concepts

### 1. Generic Brief Schema

The foundation is `GenericBrief`, which includes:

- **Core fields**: id, type, title, description
- **Context**: targetAudience, goals, constraints
- **Deliverables**: structured outputs with due dates
- **Quality metadata**: completeness, clarity, specificity scores
- **Issues**: identified gaps with severity and suggestions

### 2. Normalization Process

```typescript
Raw text → LLM with prompt → Structured JSON → Validation → Quality scoring
```

1. Build prompt using `buildBriefNormalizationPrompt()`
2. Send to LLM via `LLMClient` interface
3. Parse and validate response
4. Score quality across multiple dimensions
5. Return normalized brief with quality assessment

### 3. Quality Scoring

Four key dimensions:

- **Completeness** (0-100): Are all necessary fields present?
- **Clarity** (0-100): Is the brief unambiguous?
- **Specificity** (0-100): Are there concrete details?
- **Actionability** (0-100): Can someone immediately act on this?

### 4. Domain Variants

Extend `GenericBrief` for specific use cases:

- **MarketingBrief**: channels, budget, SEO keywords, campaign objectives
- **JobBrief**: skills, compensation, location, hiring process
- **FeatureBrief**: user stories, acceptance criteria, technical requirements

## Use Cases

### Content Ops Copilot
Normalize campaign briefs from clients or stakeholders

### JobBot
Structure job descriptions for better matching and parsing

### Track App
Parse feature requests into actionable product specs

### Client Intake Forms
Convert messy form submissions into structured data

### Survey Responses
Normalize open-ended survey answers

## Integration with LLMs

The system is LLM-agnostic. Implement the `LLMClient` interface:

```typescript
import type { LLMClient } from '@/lib/schemas';

class OpenAIClient implements LLMClient {
  async generate(prompt: string, options?: { model?: string }) {
    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    return response.choices[0].message.content;
  }
}

class AnthropicClient implements LLMClient {
  async generate(prompt: string, options?: { model?: string }) {
    const response = await anthropic.messages.create({
      model: options?.model || 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  }
}
```

## Examples

See `__examples__/brief-examples.ts` for complete working examples:

1. **Marketing brief normalization** - Blog post campaign
2. **Job brief normalization** - Software engineering role
3. **Feature brief normalization** - CSV export feature
4. **Batch processing** - Multiple briefs at once
5. **Quality comparison** - Before/after revision

Run examples:
```typescript
import { runAllExamples } from '@/lib/schemas/__examples__/brief-examples';
await runAllExamples();
```

## Creating Custom Variants

Extend for your domain:

```typescript
import type { GenericBrief } from './brief-schema';

export interface EventBrief extends Omit<GenericBrief, 'type'> {
  type: 'custom';

  // Event-specific fields
  eventType?: 'conference' | 'webinar' | 'workshop';
  venue?: string;
  capacity?: number;
  ticketPrice?: number;
  speakers?: Array<{
    name: string;
    topic: string;
  }>;
}

export function validateEventBrief(brief: EventBrief) {
  // Custom validation logic
}
```

## API Reference

### Core Functions

- `normalizeBrief(rawInput, briefType, llmClient, options?)` - Main normalization function
- `scoreBrief(brief, options?)` - Calculate quality scores
- `validateBriefSchema(obj)` - Validate JSON against schema
- `generateQualityReport(brief)` - Generate formatted quality report

### Prompt Builders

- `buildBriefNormalizationPrompt(rawInput, options)` - Full normalization prompt
- `buildQuickValidationPrompt(rawInput, briefType)` - Quick validation only
- `buildImprovementPrompt(rawInput, issues)` - Generate improved version

### Utility Functions

- `calculateOverallQuality(brief)` - Weighted quality score
- `needsRevision(brief, threshold?)` - Check if revision needed
- `compareBriefQuality(before, after)` - Compare two versions

## Best Practices

1. **Use strict mode for critical briefs**: Set `strictMode: true` when quality matters
2. **Provide custom instructions**: Add domain context for better results
3. **Iterate on low-quality briefs**: Use suggestions to improve before proceeding
4. **Log quality scores**: Track normalization quality over time
5. **Extend for your domain**: Create custom variants rather than forcing into generic schema

## License

Part of Track App MVP - see root LICENSE file

## Credits

Extracted from Content Ops Copilot W01/W02 workflows and generalized for reuse across projects.
