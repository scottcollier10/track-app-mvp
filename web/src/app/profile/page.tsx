import { createServerClient } from '@/lib/supabase/client';
import { getDriverProfile, createDriverProfile } from '@/data/driverProfiles';
import ProfileForm from './ProfileForm';
import DriverStats from '@/components/profile/DriverStats';
import { Card } from '@/components/ui/Card';
import { User, Mail } from 'lucide-react';

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Driver Profile</h1>
          <p className="text-slate-400 mt-2 leading-relaxed">
            Manage your driver profile and preferences
          </p>
        </div>
        <Card className="bg-red-900/20 border-red-800/50">
          <h3 className="text-red-200 font-semibold mb-2">
            Error Loading Profile
          </h3>
          <p className="text-red-300 text-sm leading-relaxed">
            {driversError?.message || 'No drivers found in database.'}
          </p>
        </Card>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Driver Profile</h1>
          <p className="text-slate-400 mt-2 leading-relaxed">
            Manage your driver profile and preferences
          </p>
        </div>
        <Card className="bg-red-900/20 border-red-800/50">
          <h3 className="text-red-200 font-semibold mb-2">
            Error Loading Profile
          </h3>
          <p className="text-red-300 text-sm leading-relaxed">
            {profileError.message}
          </p>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Driver Profile</h1>
          <p className="text-slate-400 mt-2 leading-relaxed">
            Manage your driver profile and preferences
          </p>
        </div>
        <Card className="bg-amber-900/20 border-amber-800/50">
          <h3 className="text-amber-200 font-semibold mb-2">
            Profile Not Found
          </h3>
          <p className="text-amber-300 text-sm leading-relaxed">
            Unable to load or create driver profile.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Driver Profile</h1>
        <p className="text-slate-400 mt-2 leading-relaxed">
          Manage your driver profile and preferences
        </p>
      </div>

      {/* Driver Info Card */}
      <Card>
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Driver Information</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">Name</span>
              <p className="text-lg font-medium text-slate-100">{driver.name}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">Email</span>
              <p className="text-lg text-slate-200">{driver.email}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Driver Statistics */}
      <DriverStats driverId={driver.id} />

      {/* Profile Form */}
      <ProfileForm
        driverId={driver.id}
        initialExperienceLevel={profile.experience_level}
        totalSessions={profile.total_sessions}
      />
    </div>
  );
}
