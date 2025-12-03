import React from 'react';
import { Smartphone, Activity, Timer, Database } from 'lucide-react';

interface SourceBadgeProps {
  source: string;
  size?: 'sm' | 'md';
}

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const config = getSourceConfig(source);
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${config.bgClass} ${config.textClass}`}
    >
      <config.icon className={iconSize} />
      {config.label}
    </span>
  );
}

function getSourceConfig(source: string) {
  const normalized = source.toLowerCase();

  if (normalized === 'racechrono') {
    return {
      label: 'RaceChrono',
      icon: Smartphone,
      bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
      textClass: 'text-blue-700 dark:text-blue-300',
    };
  }

  if (normalized === 'aim') {
    return {
      label: 'AiM',
      icon: Activity,
      bgClass: 'bg-red-500/10 dark:bg-red-500/20',
      textClass: 'text-red-700 dark:text-red-300',
    };
  }

  if (normalized === 'trackaddict') {
    return {
      label: 'TrackAddict',
      icon: Timer,
      bgClass: 'bg-purple-500/10 dark:bg-purple-500/20',
      textClass: 'text-purple-700 dark:text-purple-300',
    };
  }

  if (normalized === 'ios_app') {
    return {
      label: 'iOS App',
      icon: Smartphone,
      bgClass: 'bg-gray-500/10 dark:bg-gray-500/20',
      textClass: 'text-gray-700 dark:text-gray-300',
    };
  }

  return {
    label: 'Generic',
    icon: Database,
    bgClass: 'bg-gray-500/10 dark:bg-gray-500/20',
    textClass: 'text-gray-700 dark:text-gray-300',
  };
}
