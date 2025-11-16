/**
 * Driver Types
 *
 * Types for drivers and driver profiles
 */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface DriverProfile {
  id: string;
  driverId: string;
  experienceLevel: ExperienceLevel;
  totalSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  profile?: DriverProfile;
}
