import React from 'react';

interface LandingTechBadgeProps {
  name: string;
}

export function LandingTechBadge({ name }: LandingTechBadgeProps) {
  return (
    <div className="inline-flex items-center px-4 py-2 rounded-full bg-landing-blue/10 border border-landing-blue/30 text-landing-blue font-medium text-sm">
      {name}
    </div>
  );
}
