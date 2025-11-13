'use client';

/**
 * CoachNotes Component
 *
 * Allows coaches to edit and save notes for a session
 * Only visible when coach view is enabled
 * Saves to sessions.coach_notes column
 */

import { useState, useEffect } from 'react';
import { useCoachView } from './CoachViewToggle';

interface CoachNotesProps {
  sessionId: string;
  initialNotes: string | null;
}

export default function CoachNotes({ sessionId, initialNotes }: CoachNotesProps) {
  const isCoachView = useCoachView();
  const [notes, setNotes] = useState(initialNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setNotes(initialNotes || '');
  }, [initialNotes]);

  if (!isCoachView) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coach_notes: notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving coach notes:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-sm p-6 border-2 border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>🎓</span>
          Coach Notes
        </h2>
        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
          COACH VIEW
        </span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add coaching feedback, observations, areas for improvement, or strategy notes..."
        rows={6}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 text-sm"
      />

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {notes.length} characters
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
              Failed to save
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
