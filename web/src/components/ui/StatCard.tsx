import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: 'blue' | 'green' | 'default';
}

export function StatCard({ icon: Icon, label, value, color = 'default' }: StatCardProps) {
  const iconColorClasses = {
    blue: 'text-blue-default',
    green: 'text-green-default',
    default: 'text-text-secondary',
  };

  return (
    <div className="bg-background-card rounded-lg p-6 border border-background-elevated">
      <div className="flex items-center gap-3 mb-4">
        <Icon className={`w-5 h-5 ${iconColorClasses[color]}`} />
        <p className="text-xs uppercase tracking-wide text-text-secondary font-semibold">
          {label}
        </p>
      </div>
      <div className="text-4xl font-semibold text-text-primary font-mono">
        {value}
      </div>
    </div>
  );
}
