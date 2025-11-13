'use client';

/**
 * CoachViewToggle Component
 *
 * Toggle for enabling/disabling coach view features
 * Stores state in localStorage
 */

import { useEffect, useState } from 'react';

export default function CoachViewToggle() {
  const [isCoachView, setIsCoachView] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('coachViewEnabled');
    setIsCoachView(stored === 'true');
  }, []);

  const handleToggle = () => {
    const newValue = !isCoachView;
    setIsCoachView(newValue);
    localStorage.setItem('coachViewEnabled', String(newValue));
    // Trigger a custom event to notify other components
    window.dispatchEvent(new Event('coach-view-changed'));
  };

  // Avoid hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Coach View:</span>
        <div className="w-12 h-6 bg-gray-300 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">Coach View:</span>
      <button
        onClick={handleToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          isCoachView
            ? 'bg-green-600 dark:bg-green-500'
            : 'bg-gray-300 dark:bg-gray-600'
        }`}
        aria-label={`Coach View ${isCoachView ? 'On' : 'Off'}`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            isCoachView ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
        {isCoachView ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

/**
 * Hook to check if coach view is enabled
 * Use in client components
 */
export function useCoachView() {
  const [isCoachView, setIsCoachView] = useState(false);

  useEffect(() => {
    // Initial load
    const stored = localStorage.getItem('coachViewEnabled');
    setIsCoachView(stored === 'true');

    // Listen for changes
    const handleChange = () => {
      const stored = localStorage.getItem('coachViewEnabled');
      setIsCoachView(stored === 'true');
    };

    window.addEventListener('coach-view-changed', handleChange);
    return () => window.removeEventListener('coach-view-changed', handleChange);
  }, []);

  return isCoachView;
}
