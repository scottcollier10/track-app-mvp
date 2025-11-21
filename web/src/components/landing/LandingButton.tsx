import React from 'react';
import Link from 'next/link';

interface LandingButtonProps {
  children: React.ReactNode;
  href?: string;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  className?: string;
}

export function LandingButton({
  children,
  href,
  variant = 'primary',
  onClick,
  className = ''
}: LandingButtonProps) {
  const baseStyles = "inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 text-base";

  const variantStyles = {
    primary: "bg-landing-green text-white hover:bg-landing-green/90 hover:scale-105 shadow-lg shadow-landing-green/20",
    secondary: "bg-transparent border-2 border-landing-text/20 text-landing-text hover:border-landing-text/40 hover:bg-landing-text/5"
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={combinedStyles} target="_blank" rel="noopener noreferrer">
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={combinedStyles}>
      {children}
    </button>
  );
}
