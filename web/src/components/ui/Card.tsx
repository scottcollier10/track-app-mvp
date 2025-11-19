import { HTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', noPadding = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-surface border border-subtle rounded-xl ${noPadding ? '' : 'p-4 md:p-6'} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', icon: Icon, iconColor = 'text-accent-primary', action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between mb-4 ${className}`}
        {...props}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
          {children}
        </div>
        {action}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-base font-medium text-primary ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm text-muted ${className}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 pt-4 border-t border-subtle ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export type { CardProps, CardHeaderProps, CardTitleProps, CardDescriptionProps, CardContentProps, CardFooterProps };
