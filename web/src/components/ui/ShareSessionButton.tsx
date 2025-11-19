'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

export default function ShareSessionButton() {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const handleShare = async () => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        throw new Error('Clipboard not supported');
      }

      // Copy current page URL to clipboard
      await navigator.clipboard.writeText(window.location.href);

      // Show success toast
      setToastType('success');
      setToastMessage('Session link copied to clipboard!');
      setShowToast(true);

      // Hide toast after 3 seconds
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Failed to copy URL:', err);

      // Show error toast
      setToastType('error');
      setToastMessage('Failed to copy link. Please copy the URL manually.');
      setShowToast(true);

      // Hide toast after 4 seconds
      setTimeout(() => setShowToast(false), 4000);
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        aria-label="Share session"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share Session</span>
      </button>

      {/* Toast notification */}
      {showToast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            toastType === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
          role="alert"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
