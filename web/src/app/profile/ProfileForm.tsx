'use client';

import { useState } from 'react';
import { ExperienceLevel } from '@/types/driver';

interface ProfileFormProps {
  driverId: string;
  initialExperienceLevel: ExperienceLevel;
  totalSessions: number;
}

export default function ProfileForm({
  driverId,
  initialExperienceLevel,
  totalSessions,
}: ProfileFormProps) {
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(initialExperienceLevel);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId,
          experienceLevel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Refresh the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelDescription = (level: ExperienceLevel): string => {
    switch (level) {
      case 'beginner':
        return 'New to track driving, learning fundamentals';
      case 'intermediate':
        return 'Comfortable on track, working on consistency';
      case 'advanced':
        return 'Experienced driver, focused on optimization';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Track Experience</h2>

        {/* Total Sessions (Read-only) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Total Sessions Completed
          </label>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalSessions}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              sessions
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Auto-incremented when you complete track sessions
          </p>
        </div>

        {/* Experience Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Experience Level
          </label>
          <div className="space-y-3">
            {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map((level) => (
              <label
                key={level}
                className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                  experienceLevel === level
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                }`}
              >
                <input
                  type="radio"
                  name="experienceLevel"
                  value={level}
                  checked={experienceLevel === level}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3 flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {level}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {getLevelDescription(level)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isLoading
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
              : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white'
          }`}
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
