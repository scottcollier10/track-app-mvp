import React from 'react';

interface LandingStatCardProps {
  label: string;
  value: string;
}

export function LandingStatCard({ label, value }: LandingStatCardProps) {
  return (
    <div className="bg-landing-cardBg border border-landing-border rounded-lg p-6 text-center hover:border-landing-green/30 transition-all duration-200">
      <div className="text-3xl font-bold text-landing-text mb-2">{value}</div>
      <div className="text-sm text-landing-text/60">{label}</div>
    </div>
  );
}
