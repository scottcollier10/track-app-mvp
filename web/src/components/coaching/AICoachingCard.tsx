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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Bot, ThumbsUp, Target, Gift, AlertTriangle } from "lucide-react";

interface AICoachingCardProps {
  sessionId: string;
  initialCoaching: string | null;
}

interface CoachingSection {
  title: string;
  content: string[];
  color: string;
  icon: typeof ThumbsUp;
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
      let color = 'text-muted';
      let icon = Target;

      if (title.includes('Strength')) {
        color = 'text-status-success';
        icon = ThumbsUp;
      } else if (title.includes('Improvement')) {
        color = 'text-status-warn';
        icon = AlertTriangle;
      } else if (title.includes('Goal')) {
        color = 'text-status-info';
        icon = Gift;
      }

      currentSection = { title, content: [], color, icon };
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

  // Hide completely when Coach View is OFF
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
    <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-4 md:p-6 border border-purple-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          AI Coaching
        </h2>
        <Badge variant="neutral" className="bg-purple-600/50 text-purple-200 border-purple-500/50">
          COACH VIEW
        </Badge>
      </div>

      {/* State 1: NOT GENERATED */}
      {!coaching && !isGenerating && (
        <div className="space-y-4">
          <p className="text-muted text-sm">
            Generate personalized coaching feedback powered by Anthropic Claude.
            AI analysis includes strengths, areas for improvement, and actionable goals based on session data.
          </p>
          <Button
            onClick={handleGenerate}
            className="w-full bg-purple-600 hover:bg-purple-700 border-purple-500"
          >
            Generate AI Coaching
          </Button>
        </div>
      )}

      {/* State 2: GENERATING */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <p className="text-muted font-medium">Analyzing session data...</p>
          <p className="text-text-subtle text-sm">This may take 5-10 seconds</p>
        </div>
      )}

      {/* State 3: GENERATED */}
      {coaching && !isGenerating && (
        <div className="space-y-6">
          {/* Coaching Sections */}
          {sections.map((section, idx) => {
            const SectionIcon = section.icon;
            return (
              <div key={idx} className="space-y-3">
                <h3 className={`text-lg font-semibold ${section.color} flex items-center gap-2`}>
                  <SectionIcon className="w-5 h-5" />
                  {section.title}
                </h3>
                <div className="space-y-2 pl-7">
                  {section.content.map((line, lineIdx) => (
                    <p key={lineIdx} className="text-primary/90 text-sm leading-relaxed">
                      {line.startsWith('-') || line.startsWith('•') ? (
                        <span className="flex gap-2">
                          <span className="text-text-subtle">•</span>
                          <span>{line.replace(/^[-•]\s*/, '')}</span>
                        </span>
                      ) : (
                        line
                      )}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Regenerate Button */}
          <div className="pt-4 border-t border-purple-700/50">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              variant="secondary"
              className="border-purple-600/50 hover:bg-purple-800/30"
            >
              Regenerate Coaching
            </Button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 bg-status-critical/20 border border-status-critical/30 rounded-lg p-4">
          <p className="text-status-critical text-sm font-medium mb-1">Error</p>
          <p className="text-status-critical/80 text-sm">{error}</p>
          <Button
            onClick={handleGenerate}
            size="sm"
            className="mt-3 bg-status-critical hover:bg-status-critical/90"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
