import { ReactNode } from 'react';

interface HeroCardProps {
  children: ReactNode;
  className?: string;
}

export function HeroCard({ children, className = '' }: HeroCardProps) {
  return (
    <div
      className={`bg-gradient-to-br from-blue-dark to-blue-default rounded-lg p-6 md:p-8 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

interface HeroCardHeaderProps {
  label: string;
  title: string;
  subtitle: string;
}

export function HeroCardHeader({ label, title, subtitle }: HeroCardHeaderProps) {
  return (
    <div>
      <p className="text-xs md:text-sm font-semibold text-blue-light mb-2 uppercase tracking-wide">
        {label}
      </p>
      <h2 className="text-xl md:text-2xl font-semibold text-text-primary mb-2">
        {title}
      </h2>
      <p className="text-text-secondary text-sm">
        {subtitle}
      </p>
    </div>
  );
}

interface HeroCardStatsProps {
  primaryValue: string;
  primaryLabel: string;
  secondaryValue?: string;
}

export function HeroCardStats({ primaryValue, primaryLabel, secondaryValue }: HeroCardStatsProps) {
  return (
    <div className="text-left md:text-right">
      <div className="text-3xl md:text-4xl font-mono font-semibold text-green-default">
        {primaryValue}
      </div>
      <p className="text-xs md:text-sm text-text-secondary mt-1">
        {primaryLabel}
      </p>
      {secondaryValue && (
        <p className="text-xs text-text-muted mt-1">
          {secondaryValue}
        </p>
      )}
    </div>
  );
}
