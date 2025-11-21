import React from 'react';

interface LandingShowcaseCardProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
}

export function LandingShowcaseCard({
  title,
  description,
  imageSrc,
  imageAlt
}: LandingShowcaseCardProps) {
  return (
    <div className="bg-landing-cardBg border border-landing-border rounded-lg overflow-hidden hover:border-landing-green/30 transition-all duration-200 hover:scale-105">
      <figure className="border-b border-landing-border">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full h-auto"
        />
      </figure>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-landing-text mb-2">{title}</h3>
        <p className="text-landing-text/70 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
