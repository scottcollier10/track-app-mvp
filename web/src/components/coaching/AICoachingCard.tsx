"use client";

/**
 * AI Coaching Card Component
 *
 * Displays AI-generated coaching feedback from Anthropic Claude
 * Three states: Not Generated, Generating, Generated
 * Only visible when coach view is enabled
 */

import { useState } from "react";
import { useCoachView } from "@/context/coach-view";

interface AICoachingCardProps {
  sessionId: string;
  initialCoaching: string | null;
}

interface CoachingSection {
  title: string;
  content: string[];
  color: string;
  emoji: string;
}

/**
 * Parse markdown coaching text into structured sections
 */
function parseCoaching(text: string): CoachingSection[] {
  const sections: CoachingSection[] = [];
  const lines = text.split('\n');
  let currentSection: CoachingSection | null = null;

  for (const line of lines) {
    // Match section headers (## Title)
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }

      // Create new section
      const title = line.replace('## ', '').trim();
      let color = 'text-gray-300';
      let emoji = '📝';

      if (title.includes('Strength')) {
        color = 'text-green-400';
        emoji = '💪';
      } else if (title.includes('Improvement')) {
        color = 'text-amber-400';
        emoji = '🎯';
      } else if (title.includes('Goal')) {
        color = 'text-blue-400';
        emoji = '🎁';
      }

      currentSection = { title, content: [], color, emoji };
    } else if (line.trim() && currentSection) {
      // Add content to current section (skip empty lines)
      currentSection.content.push(line.trim());
    }
  }

  // Save last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

export default function AICoachingCard({
  sessionId,
  initialCoaching,
}: AICoachingCardProps) {
  const { coachView } = useCoachView();
  const [coaching, setCoaching] = useState<string | null>(initialCoaching);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔒 Hide completely when Coach View is OFF
  if (!coachView) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/coaching/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Handle specific error messages
        if (data.error?.includes('API key')) {
          throw new Error('AI coaching requires API key configuration. Please add ANTHROPIC_API_KEY to .env.local');
        } else if (data.error?.includes('not found')) {
          throw new Error('Session or laps not found');
        } else {
          throw new Error(data.error || 'Failed to generate coaching');
        }
      }

      setCoaching(data.coaching);
    } catch (err) {
      console.error('Error generating coaching:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  // Parse coaching into sections if available
  const sections = coaching ? parseCoaching(coaching) : [];

  return (
    <div className="bg-purple-900/20 rounded-lg shadow-sm p-6 border-2 border-purple-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>🤖</span>
          AI Coaching
        </h2>
        <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
          COACH VIEW
        </span>
      </div>

      {/* State 1: NOT GENERATED */}
      {!coaching && !isGenerating && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Generate personalized coaching feedback powered by Anthropic Claude.
            AI analysis includes strengths, areas for improvement, and actionable goals based on session data.
          </p>
          <button
            onClick={handleGenerate}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Generate AI Coaching
          </button>
        </div>
      )}

      {/* State 2: GENERATING */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          <p className="text-gray-400 font-medium">Analyzing session data...</p>
          <p className="text-gray-500 text-sm">This may take 5-10 seconds</p>
        </div>
      )}

      {/* State 3: GENERATED */}
      {coaching && !isGenerating && (
        <div className="space-y-6">
          {/* Coaching Sections */}
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className={`text-lg font-bold ${section.color} flex items-center gap-2`}>
                <span>{section.emoji}</span>
                {section.title}
              </h3>
              <div className="space-y-2 pl-6">
                {section.content.map((line, lineIdx) => (
                  <p key={lineIdx} className="text-gray-300 text-sm leading-relaxed">
                    {line.startsWith('-') || line.startsWith('•') ? (
                      <span className="flex gap-2">
                        <span className="text-gray-500">•</span>
                        <span>{line.replace(/^[-•]\s*/, '')}</span>
                      </span>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Regenerate Button */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Regenerate Coaching
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm font-medium mb-1">Error</p>
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={handleGenerate}
            className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
