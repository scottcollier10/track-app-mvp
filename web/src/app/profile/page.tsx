import { createServerClient } from '@/lib/supabase/client';
import { getDriverProfile, createDriverProfile } from '@/data/driverProfiles';
import ProfileForm from './ProfileForm';
import DriverStats from '@/components/profile/DriverStats';
import { ProgressTimeline } from '@/components/profile/ProgressTimeline';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createServerClient();

  // For MVP: Get the first driver (in production, this would be the authenticated user)
  const { data: drivers, error: driversError } = await (supabase
    .from('drivers') as any)
    .select('*')
    .limit(1)
    .single();

  // Error state
  if (driversError || !drivers) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Driver Profile</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your driver profile and preferences
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
                Error Loading Profile
              </h3>
              <p className="text-red-700 dark:text-red-300 text-sm">
                {driversError?.message || 'No drivers found in database.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const driver = drivers;

  // Fetch or create driver profile
  let { data: profile, error: profileError } = await getDriverProfile(driver.id);

  // If no profile exists, create a default one
  if (!profile && !profileError) {
    const { data: newProfile, error: createError } = await createDriverProfile(
      driver.id,
      'intermediate'
    );

    if (createError) {
      profileError = createError;
    } else {
      profile = newProfile;
    }
  }

  if (profileError) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Driver Profile</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your driver profile and preferences
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
                Error Loading Profile
              </h3>
              <p className="text-red-700 dark:text-red-300 text-sm">
                {profileError.message}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Driver Profile</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your driver profile and preferences
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
              <h3 className="text-yellow-900 dark:text-yellow-200 font-semibold mb-2">
                Profile Not Found
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                Unable to load or create driver profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Driver Profile</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your driver profile and preferences
            </p>
          </div>

          {/* Driver Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Driver Information</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
                <p className="text-lg font-medium">{driver.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                <p className="text-lg">{driver.email}</p>
              </div>
            </div>
          </div>

          {/* Driver Statistics */}
          <DriverStats driverId={driver.id} />

          {/* Track Progress */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Track Progress</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Your performance history at each circuit
              </p>
            </div>
            <ProgressTimeline driverId={driver.id} />
          </div>

          {/* Profile Form */}
          <ProfileForm
            driverId={driver.id}
            initialExperienceLevel={profile.experience_level}
            totalSessions={profile.total_sessions}
          />
        </div>
      </div>
    </div>
  );
}
