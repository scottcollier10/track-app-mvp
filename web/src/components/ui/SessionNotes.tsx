"use client";

/**
 * SessionNotes Component
 *
 * Allows users to add and edit notes for a session
 * Saves to sessions.notes column
 */

import { useState, useEffect } from "react";

interface SessionNotesProps {
  sessionId: string;
  initialNotes: string | null;
}

export default function SessionNotes({
  sessionId,
  initialNotes,
}: SessionNotesProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(initialNotes || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || "");
  }, [initialNotes]);

  async function saveNotes() {
    setIsSaving(true);
    const response = await fetch(`/api/sessions/${sessionId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (response.ok) {
      setIsEditingNotes(false);
    }
    setIsSaving(false);
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Session Notes</h2>
        {!isEditingNotes ? (
          <button
            onClick={() => setIsEditingNotes(true)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {notes ? "Edit" : "Add Notes"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={saveNotes}
              disabled={isSaving}
              className="text-sm px-3 py-1 bg-green-600 rounded hover:bg-green-700"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsEditingNotes(false);
                setNotes(initialNotes || "");
              }}
              className="text-sm px-3 py-1 bg-slate-600 rounded hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {isEditingNotes ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-32 bg-slate-700 text-white rounded p-3 resize-none"
          placeholder="Add observations, feedback, or coaching notes..."
        />
      ) : (
        <div className="text-slate-300 whitespace-pre-wrap">
          {notes || <span className="text-slate-500 italic">No notes yet</span>}
        </div>
      )}
    </div>
  );
}
