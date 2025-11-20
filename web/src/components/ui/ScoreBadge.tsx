interface ScoreBadgeProps {
  score: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  className?: string;
}

export function ScoreBadge({ score, className = '' }: ScoreBadgeProps) {
  const scoreStyles = {
    EXCELLENT: 'border-green-default text-green-default',
    GOOD: 'border-blue-default text-blue-default',
    FAIR: 'border-text-secondary text-text-secondary',
    POOR: 'border-red-default text-red-default',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border-2 text-xs font-semibold uppercase tracking-wide ${scoreStyles[score]} ${className}`}
    >
      {score}
    </span>
  );
}
