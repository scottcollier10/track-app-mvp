/**
 * Track App Analytics - Session Performance Calculations
 * Exports both naming conventions for compatibility
 */

export function calculateConsistency(lapTimes: number[]): number | null {
  if (!lapTimes || lapTimes.length < 2) return null;
  
  const validTimes = lapTimes.filter(t => typeof t === 'number' && t > 0 && isFinite(t));
  if (validTimes.length < 2) return null;
  
  const mean = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
  if (mean === 0) return null;
  
  const squaredDiffs = validTimes.map(time => Math.pow(time - mean, 2));
  const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / (validTimes.length - 1);
  const std = Math.sqrt(variance);
  
  const cv = std / mean;
  const rawScore = (1 - cv) * 100;
  
  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

// Alias for compatibility
export const calculateConsistencyScore = calculateConsistency;

export function calculateDrivingBehavior(lapTimes: number[]): number | null {
  if (!lapTimes || lapTimes.length < 2) return null;
  
  const validTimes = lapTimes.filter(t => typeof t === 'number' && t > 0 && isFinite(t));
  if (validTimes.length < 2) return null;
  
  const mean = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
  if (mean === 0) return null;
  
  const squaredDiffs = validTimes.map(time => Math.pow(time - mean, 2));
  const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / (validTimes.length - 1);
  const std = Math.sqrt(variance);
  
  const cv = std / mean;
  const rawScore = 100 - (cv * 100);
  
  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

// Alias for compatibility
export const calculateBehaviorScore = calculateDrivingBehavior;

export function calculatePaceTrend(lapTimes: number[]): 'improving' | 'fading' | 'stable' | null {
  if (!lapTimes || lapTimes.length < 6) return null;
  
  const validTimes = lapTimes.filter(t => typeof t === 'number' && t > 0 && isFinite(t));
  if (validTimes.length < 6) return null;
  
  const first3 = validTimes.slice(0, 3);
  const last3 = validTimes.slice(-3);
  
  const first3Avg = first3.reduce((sum, t) => sum + t, 0) / 3;
  const last3Avg = last3.reduce((sum, t) => sum + t, 0) / 3;
  
  const delta = (last3Avg - first3Avg) / first3Avg;
  const threshold = 0.01;
  
  if (delta <= -threshold) return 'improving';
  if (delta >= threshold) return 'fading';
  return 'stable';
}