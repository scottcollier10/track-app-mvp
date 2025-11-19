import { HTMLAttributes, forwardRef } from 'react';

type BadgeVariant = 'info' | 'success' | 'warn' | 'critical' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  info: 'bg-status-info/20 text-status-info border-status-info/30',
  success: 'bg-status-success/20 text-status-success border-status-success/30',
  warn: 'bg-status-warn/20 text-status-warn border-status-warn/30',
  critical: 'bg-status-critical/20 text-status-critical border-status-critical/30',
  neutral: 'bg-subtle text-muted border-strong',
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'neutral', className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';

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
