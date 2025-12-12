import SessionsList from '@/components/sessions/SessionsList';
import { SessionFilter } from '@/components/sessions/SessionFilters';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

export const dynamic = 'force-dynamic';

interface SessionsPageProps {
  searchParams: Promise<{
    driverId?: string;
    trackId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const params = await searchParams;

  // Build initial filters from URL params
  const initialFilters: SessionFilter = {};
  if (params.driverId) initialFilters.driverId = params.driverId;
  if (params.trackId) initialFilters.trackId = params.trackId;
  if (params.startDate) initialFilters.startDate = params.startDate;
  if (params.endDate) initialFilters.endDate = params.endDate;

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10">
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl gap-8 px-4 pb-16 pt-24">
            <SessionsList filters={initialFilters} />
          </div>
        </div>
      </div>
    </div>
  );
}