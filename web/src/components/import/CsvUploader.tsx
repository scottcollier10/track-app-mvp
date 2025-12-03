import React, { useCallback } from 'react';
import { Upload, Download } from 'lucide-react';

interface CsvUploaderProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

export default function CsvUploader({ onFileSelect, isUploading }: CsvUploaderProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'text/csv') {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-600 dark:border-gray-700 rounded-lg p-12 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          id="csv-upload"
          disabled={isUploading}
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            or click to browse your files
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Supports CSV files from RaceChrono, AiM, TrackAddict, and other timing systems
          </p>
        </label>
      </div>

      {/* Template Downloads */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Need a template? Download a sample CSV:
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <a
            href="/api/templates/racechrono"
            download="track-app-racechrono-template.csv"
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-center"
          >
            RaceChrono Format
          </a>
          
          <a
            href="/api/templates/aim"
            download="track-app-aim-template.csv"
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-center"
          >
            AiM Format
          </a>
          
          <a
            href="/api/templates/trackaddict"
            download="track-app-trackaddict-template.csv"
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-center"
          >
            TrackAddict Format
          </a>
          
          <a
            href="/api/templates/generic"
            download="track-app-generic-template.csv"
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-center"
          >
            Generic Format
          </a>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Each download generates unique test data to prevent duplicates during testing.
        </p>
      </div>
    </div>
  );
}
