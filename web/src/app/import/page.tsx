/**
 * CSV Import Page
 * Allows coaches to upload lap data from any source
 */

import CsvImport from '@/components/import/CsvImport';

export const metadata = {
  title: 'Import CSV | Track App',
  description: 'Import lap data from CSV files',
};

export default function ImportPage() {
  return (
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
  );
}
