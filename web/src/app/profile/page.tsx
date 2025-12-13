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
            <div className="rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <h3 className="text-rose-400 font-semibold mb-2">
                Error Loading Profile
              </h3>
              <p className="text-slate-300 text-sm">
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
            <div className="rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <h3 className="text-rose-400 font-semibold mb-2">
                Error Loading Profile
              </h3>
              <p className="text-slate-300 text-sm">
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
            <div className="rounded-2xl border border-amber-500/45 bg-gradient-to-b from-amber-500/16 via-amber-500/6 to-slate-950/80 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <h3 className="text-amber-400 font-semibold mb-2">
                Profile Not Found
              </h3>
              <p className="text-slate-300 text-sm">
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
            <h1 className="text-3xl font-bold text-slate-50">Driver Profile</h1>
            <p className="text-slate-400 mt-2">
              Manage your driver profile and preferences
            </p>
          </div>

          {/* Driver Info Card */}
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <h2 className="text-xl font-semibold mb-4 text-slate-50">Driver Information</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-slate-400">Name</span>
                <p className="text-lg font-medium text-slate-50">{driver.name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Email</span>
                <p className="text-lg text-slate-200">{driver.email}</p>
              </div>
            </div>
          </div>

          {/* Driver Statistics */}
          <DriverStats driverId={driver.id} />

          {/* Track Progress */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">Track Progress</h2>
              <p className="text-sm text-slate-400 mt-1">
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
