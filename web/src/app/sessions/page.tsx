import SessionsHeader from '@/components/sessions/SessionsHeader';
import SessionsList from '@/components/sessions/SessionsList';

export const dynamic = 'force-dynamic';

export default function SessionsPage() {
  return (
    <div className="space-y-6">
      <SessionsHeader />
      <SessionsList />
    </div>
  );
}