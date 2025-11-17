/**
 * ScoreBreakdown Component
 *
 * Displays multiple score factors in a list format.
 * Useful for showing detailed breakdowns of composite scores.
 */

export interface ScoreBreakdownItem {
  label: string;
  value: number | string;
  description?: string;
}

export interface ScoreBreakdownProps {
  items: ScoreBreakdownItem[];
  className?: string;
}

export default function ScoreBreakdown({
  items,
  className = '',
}: ScoreBreakdownProps) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800 ${className}`}
    >
      {items.map((item, index) => (
        <div key={index} className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-300">
              {item.label}
            </span>
            <span className="text-lg font-bold text-white">
              {typeof item.value === 'number' ? Math.round(item.value) : item.value}
            </span>
          </div>
          {item.description && (
            <p className="text-xs text-gray-500">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
