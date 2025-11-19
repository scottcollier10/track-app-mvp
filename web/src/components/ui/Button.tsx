import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm',
  secondary: 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-slate-500 text-slate-100',
  ghost: 'bg-transparent hover:bg-slate-700/50 border-transparent text-slate-300 hover:text-slate-100',
  destructive: 'bg-red-600 hover:bg-red-700 text-white border-transparent shadow-sm',
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
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed';

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
