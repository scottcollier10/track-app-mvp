'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Calendar,
  Timer,
  MapPin,
  ChevronDown,
  ChevronUp,
  Star,
  Activity,
  Flag,
} from 'lucide-react';
import Link from 'next/link';

interface SessionData {
  sessionId: string;
  date: string;
  bestLap: number;
  lapCount: number;
}

interface TrackProgress {
  trackId: string;
  trackName: string;
  trackLocation: string;
  visitCount: number;
  personalBest: number;
  firstSessionBest: number;
  mostRecentBest: number;
  improvementPercent: number;
  allSessions: SessionData[];
}

interface OverallStats {
  totalSessions: number;
  totalLaps: number;
  tracksVisited: number;
  avgImprovementPercent: number;
}

interface ProgressData {
  trackProgress: TrackProgress[];
  overallStats: OverallStats;
}

interface ProgressTimelineProps {
  driverId: string;
}

function formatLapTime(ms: number): string {
  if (ms === 0) return '--:--.---';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function TrackProgressCard({ track }: { track: TrackProgress }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasImprovement = track.visitCount > 1 && track.improvementPercent !== 0;
  const isImproved = track.improvementPercent > 0;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Track Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-primary">
              {track.trackName}
            </h3>
            {track.trackLocation && (
              <div className="flex items-center gap-1 text-sm text-muted mt-1">
                <MapPin className="w-3 h-3" />
                <span>{track.trackLocation}</span>
              </div>
            )}
          </div>
          <Badge variant="neutral">{track.visitCount} {track.visitCount === 1 ? 'visit' : 'visits'}</Badge>
        </div>

        {/* Personal Best & Improvement */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          {/* Personal Best */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-success/10">
              <Trophy className="w-5 h-5 text-status-success" />
            </div>
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Personal Best</div>
              <div className="text-xl font-bold text-status-success">
                {formatLapTime(track.personalBest)}
              </div>
            </div>
          </div>

          {/* Improvement Stat */}
          <div className="flex items-center gap-2">
            {track.visitCount === 1 ? (
              <span className="text-sm text-muted">First visit</span>
            ) : hasImprovement ? (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                isImproved ? 'text-status-success' : 'text-status-warn'
              }`}>
                {isImproved ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {isImproved ? '↗' : '↘'} {Math.abs(track.improvementPercent).toFixed(1)}% {isImproved ? 'faster' : 'slower'}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted">No change</span>
            )}
          </div>
        </div>

        {/* View History Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          icon={isExpanded ? ChevronUp : ChevronDown}
          iconPosition="right"
          className="w-full justify-between"
        >
          {isExpanded ? 'Hide History' : 'View History'}
        </Button>

        {/* Expandable Session History */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-subtle">
            <div className="space-y-3">
              {track.allSessions
                .slice()
                .reverse()
                .map((session) => {
                  const isPB = session.bestLap === track.personalBest && session.bestLap > 0;
                  return (
                    <div
                      key={session.sessionId}
                      className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted" />
                          <span className="text-sm text-primary">
                            {formatDate(session.date)}
                          </span>
                        </div>
                        {isPB && (
                          <Star className="w-4 h-4 text-status-warn fill-status-warn" />
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-sm text-muted">
                          <Timer className="w-3 h-3" />
                          <span className={isPB ? 'text-status-success font-medium' : ''}>
                            {formatLapTime(session.bestLap)}
                          </span>
                        </div>
                        <div className="text-xs text-muted">
                          {session.lapCount} laps
                        </div>
                        <Link href={`/sessions/${session.sessionId}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-surface rounded-lg" />
        ))}
      </div>
      {/* Cards skeleton */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-surface rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Activity className="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-primary mb-2">
          No Sessions Yet
        </h3>
        <p className="text-sm text-muted mb-4">
          Start tracking your sessions to see your progress over time at each track.
        </p>
        <Link href="/sessions">
          <Button variant="primary" icon={Flag}>
            Record First Session
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function ProgressTimeline({ driverId }: ProgressTimelineProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const response = await fetch(`/api/drivers/${driverId}/progress`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress data');
        }
        const progressData = await response.json();
        setData(progressData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [driverId]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-status-critical">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.trackProgress.length === 0) {
    return <EmptyState />;
  }

  const { trackProgress, overallStats } = data;

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Sessions"
          value={overallStats.totalSessions.toString()}
          helper="Recorded sessions"
        />
        <MetricCard
          label="Tracks Visited"
          value={overallStats.tracksVisited.toString()}
          helper="Unique tracks"
        />
        <MetricCard
          label="Total Laps"
          value={overallStats.totalLaps.toString()}
          helper="Total lap count"
        />
        <MetricCard
          label="Avg Improvement"
          value={overallStats.avgImprovementPercent > 0
            ? `${overallStats.avgImprovementPercent.toFixed(1)}%`
            : '--'}
          helper="Overall progress"
        />
      </div>

      {/* Track Progress List */}
      <div className="space-y-4">
        {trackProgress.map((track) => (
          <TrackProgressCard key={track.trackId} track={track} />
        ))}
      </div>
    </div>
  );
}
