import { HTMLAttributes, forwardRef } from 'react';

type BadgeVariant = 'info' | 'success' | 'warn' | 'critical' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warn: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  neutral: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'neutral', className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export type { BadgeProps, BadgeVariant };
