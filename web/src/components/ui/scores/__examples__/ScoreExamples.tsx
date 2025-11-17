/**
 * Score Components Examples
 *
 * Demonstrates all variants, sizes, and use cases for the unified score system.
 * Can be used as a reference or added to Storybook.
 */

import ScoreCard from '../ScoreCard';
import ScoreChip from '../ScoreChip';
import ScoreBreakdown from '../ScoreBreakdown';

export default function ScoreExamples() {
  return (
    <div className="min-h-screen bg-gray-950 p-8 space-y-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">
          Score Component System
        </h1>
        <p className="text-gray-400">
          Unified scoring UI for Track App, JobBot, and Content Ops Copilot
        </p>
      </div>

      {/* ScoreCard Examples */}
      <section className="max-w-7xl mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-white">ScoreCard Component</h2>

        {/* All Score Ranges */}
        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-4">
            All Score Ranges
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              label="Excellent Score"
              score={95}
              description="Score of 90 or above shows excellent performance"
            />
            <ScoreCard
              label="Strong Score"
              score={85}
              description="Score of 80-89 shows strong performance"
            />
            <ScoreCard
              label="Moderate Score"
              score={75}
              description="Score of 70-79 shows moderate performance"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <ScoreCard
              label="Needs Work"
              score={65}
              description="Score of 60-69 needs improvement"
            />
            <ScoreCard
              label="Poor Score"
              score={45}
              description="Score below 60 needs significant work"
            />
          </div>
        </div>

        {/* With Trend Indicators */}
        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-4">
            With Trend Indicators
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              label="Improving"
              score={88}
              trend="up"
              description="Performance is trending upward"
            />
            <ScoreCard
              label="Stable"
              score={82}
              trend="stable"
              description="Performance is holding steady"
            />
            <ScoreCard
              label="Declining"
              score={76}
              trend="down"
              description="Performance is trending downward"
            />
          </div>
        </div>

        {/* Different Sizes */}
        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-4">
            Size Variants
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              label="Small Size"
              score={92}
              size="sm"
              description="Compact display for dashboards"
            />
            <ScoreCard
              label="Medium Size"
              score={87}
              size="md"
              description="Default size for most use cases"
            />
            <ScoreCard
              label="Large Size"
              score={94}
              size="lg"
              description="Emphasized display for key metrics"
            />
          </div>
        </div>

        {/* Real-World Examples */}
        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-4">
            Real-World Examples
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              label="Consistency"
              score={89}
              description="How tightly your laps group around your best times."
            />
            <ScoreCard
              label="Match Score"
              score={92}
              description="How well this candidate matches the job requirements."
            />
            <ScoreCard
              label="Content Quality"
              score={78}
              description="Overall quality score based on SEO, readability, and engagement."
            />
          </div>
        </div>
      </section>

      {/* ScoreChip Examples */}
      <section className="max-w-7xl mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-white">ScoreChip Component</h2>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-4">All Variants</h3>
          <div className="flex flex-wrap gap-3">
            <ScoreChip label="Excellent" variant="excellent" />
            <ScoreChip label="Strong" variant="strong" />
            <ScoreChip label="Moderate" variant="moderate" />
            <ScoreChip label="Needs Work" variant="needs-work" />
            <ScoreChip label="Poor" variant="poor" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-4">Size Variants</h3>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-gray-400 text-sm w-24">Small:</span>
              <ScoreChip label="Excellent" variant="excellent" size="sm" />
              <ScoreChip label="Strong" variant="strong" size="sm" />
              <ScoreChip label="Moderate" variant="moderate" size="sm" />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-gray-400 text-sm w-24">Medium:</span>
              <ScoreChip label="Excellent" variant="excellent" size="md" />
              <ScoreChip label="Strong" variant="strong" size="md" />
              <ScoreChip label="Moderate" variant="moderate" size="md" />
            </div>
          </div>
        </div>
      </section>

      {/* ScoreBreakdown Examples */}
      <section className="max-w-7xl mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          ScoreBreakdown Component
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-300 mb-4">
              Track App Session Details
            </h3>
            <ScoreBreakdown
              items={[
                {
                  label: 'Consistency',
                  value: 89,
                  description: 'Lap time variation score',
                },
                {
                  label: 'Pace Trend',
                  value: 'Improving',
                  description: 'Getting faster each lap',
                },
                {
                  label: 'Behavior',
                  value: 92,
                  description: 'Smooth and controlled driving',
                },
                {
                  label: 'Best Lap',
                  value: '1:23.456',
                  description: 'Personal best for this track',
                },
              ]}
            />
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-300 mb-4">
              JobBot Match Breakdown
            </h3>
            <ScoreBreakdown
              items={[
                {
                  label: 'Skills Match',
                  value: 95,
                  description: 'Strong alignment with required skills',
                },
                {
                  label: 'Experience',
                  value: 88,
                  description: '7 years in relevant roles',
                },
                {
                  label: 'Culture Fit',
                  value: 82,
                  description: 'Good values alignment',
                },
                {
                  label: 'Salary Expectations',
                  value: 'Aligned',
                  description: 'Within budget range',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Usage Guide */}
      <section className="max-w-7xl mx-auto space-y-4">
        <h2 className="text-2xl font-semibold text-white">Usage Guide</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-lg font-medium text-white mb-2">When to Use Each Component</h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <span className="font-semibold text-emerald-400">ScoreCard:</span> Primary
                display for scores with context and optional trends
              </li>
              <li>
                <span className="font-semibold text-green-400">ScoreChip:</span> Standalone
                labels or inline badges for quick status indication
              </li>
              <li>
                <span className="font-semibold text-yellow-400">ScoreBreakdown:</span> Detailed
                factor lists showing multiple metrics
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium text-white mb-2">Score Ranges</h3>
            <ul className="space-y-1 text-gray-300 text-sm">
              <li>90-100: Excellent (emerald)</li>
              <li>80-89: Strong (green)</li>
              <li>70-79: Moderate (yellow)</li>
              <li>60-69: Needs Work (amber)</li>
              <li>0-59: Poor (red)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
