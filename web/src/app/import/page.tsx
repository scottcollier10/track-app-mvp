/**
 * CSV Import Page
 * Allows coaches to upload lap data from any source
 */

import CsvImport from '@/components/import/CsvImport';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

export const metadata = {
  title: 'Import CSV | Track App',
  description: 'Import lap data from CSV files',
};

export default function ImportPage() {
  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10">
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl gap-8 px-4 pb-16 pt-24">
            <div className="space-y-6">
              {/* Page Header */}
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Import CSV Data</h1>
                <p className="text-neutral-400">
                  Upload lap data from RaceChrono, AiM, or any timing system
                </p>
              </div>

              {/* Import Component */}
              <CsvImport />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
