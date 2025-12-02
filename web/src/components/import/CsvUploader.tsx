'use client';

/**
 * CSV Uploader Component
 * Drag-and-drop file upload with validation
 */

import { useCallback, useState } from 'react';
import { Upload, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadTemplate } from '@/lib/csv-parser';

interface CsvUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export default function CsvUploader({ onFileSelect, isLoading }: CsvUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return 'Please upload a CSV file';
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      {/* Download Template Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={downloadTemplate}
        >
          Download Template
        </Button>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-12
          transition-all duration-200
          ${
            isDragging
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-neutral-700 bg-neutral-800/50'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : 'hover:border-neutral-600'}
        `}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileInput}
          disabled={isLoading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          id="csv-file-input"
        />

        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
          <div
            className={`
            rounded-full p-4
            ${isDragging ? 'bg-orange-500/20' : 'bg-neutral-700/50'}
            transition-colors
          `}
          >
            {isDragging ? (
              <Upload className="w-8 h-8 text-orange-500" />
            ) : (
              <FileText className="w-8 h-8 text-neutral-400" />
            )}
          </div>

          <div className="text-center">
            <p className="text-lg font-medium text-white mb-1">
              {isDragging ? 'Drop your CSV file here' : 'Upload CSV File'}
            </p>
            <p className="text-sm text-neutral-400">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              Supports RaceChrono, AiM, and custom formats
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Format Instructions */}
      <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
        <h3 className="text-sm font-medium text-white mb-2">CSV Format</h3>
        <p className="text-xs text-neutral-400 mb-2">
          Your CSV must include these columns:
        </p>
        <code className="block text-xs text-neutral-300 bg-neutral-900/50 p-2 rounded">
          session_date, track_name, driver_name, lap_number, lap_time_ms, timestamp
        </code>
      </div>
    </div>
  );
}
