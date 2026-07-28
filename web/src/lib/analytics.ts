/**
 * Track App Analytics - Session Performance Calculations
 * Only calculatePaceTrend remains; the /100 composite scores were removed
 * in favour of the ±seconds metrics in analytics-v2.
 */

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