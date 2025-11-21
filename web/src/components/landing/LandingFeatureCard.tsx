import React from 'react';
import Image from 'next/image';

interface LandingFeatureCardProps {
  icon: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
}

export function LandingFeatureCard({
  icon,
  title,
  description,
  imageSrc,
  imageAlt
}: LandingFeatureCardProps) {
  return (
    <div className="bg-landing-cardBg border border-landing-border rounded-lg overflow-hidden hover:border-landing-green/30 transition-all duration-200 hover:scale-105 group">
      <div className="p-6">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-landing-text mb-3">{title}</h3>
        <p className="text-landing-text/70 leading-relaxed">{description}</p>
      </div>
      {imageSrc && (
        <figure className="border-t border-landing-border">
          <img
            src={imageSrc}
            alt={imageAlt || title}
            className="w-full h-auto"
          />
        </figure>
      )}
    </div>
  );
}
