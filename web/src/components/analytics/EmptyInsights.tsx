import { Info } from 'lucide-react';

interface EmptyInsightsProps {
  lapCount: number;      // Actual number of laps in session
  minimumRequired?: number;  // Default 6
}

export default function EmptyInsights({
  lapCount,
  minimumRequired = 6
}: EmptyInsightsProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-8">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="rounded-full bg-blue-500/10 p-3">
          <Info className="h-8 w-8 text-blue-400" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">
            Not Enough Data for Insights
          </h3>
          <p className="text-gray-400 max-w-md">
            Session insights require at least <span className="font-medium text-white">{minimumRequired}</span> laps for accurate analysis.
            You have <span className="font-medium text-white">{lapCount}</span> lap{lapCount !== 1 ? 's' : ''}.
            Complete more laps to unlock detailed insights!
          </p>
        </div>
      </div>
    </div>
  );
}
