import SessionsList from '@/components/sessions/SessionsList';
import { SessionFilter } from '@/components/sessions/SessionFilters';

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

  return <SessionsList filters={initialFilters} />;
}