import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent-primary hover:bg-accent-primary/90 text-white border-transparent',
  secondary: 'bg-transparent hover:bg-surface border-subtle hover:border-strong text-primary',
  ghost: 'bg-transparent hover:bg-surface border-transparent text-muted hover:text-primary',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      isLoading = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary/50 disabled:opacity-50 disabled:cursor-not-allowed';

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="animate-spin rounded-full border-2 border-current border-t-transparent h-4 w-4" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon size={iconSizes[size]} />}
            {children}
            {Icon && iconPosition === 'right' && <Icon size={iconSizes[size]} />}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
