'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddNoteFormProps {
  sessionId: string;
}

export default function AddNoteForm({ sessionId }: AddNoteFormProps) {
  const router = useRouter();
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/add-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          author,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add note');
      }

      // Reset form
      setAuthor('');
      setBody('');

      // Refresh the page to show the new note
      router.refresh();
    } catch (err) {
      setError('Failed to add note. Please try again.');
      console.error('Error adding note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="author" className="block text-sm font-medium mb-2">
          Your Name
        </label>
        <input
          type="text"
          id="author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
          placeholder="Coach Name"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-track-blue focus:border-transparent dark:bg-gray-900"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium mb-2">
          Note
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          placeholder="Add coaching feedback, observations, or suggestions..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-track-blue focus:border-transparent dark:bg-gray-900"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-6 py-2 bg-track-blue text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Adding...' : 'Add Note'}
      </button>
    </form>
  );
}
