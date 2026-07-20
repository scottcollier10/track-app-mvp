/**
 * @jest-environment node
 *
 * Tests for POST /api/profile/update
 *
 * Verifies ownership scoping: a coach can only update a driver they can see.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { updateDriverProfile } from '@/data/driverProfiles';
import { getDriverById } from '@/data/drivers';

jest.mock('@/lib/auth/current-coach');
jest.mock('@/data/driverProfiles');
jest.mock('@/data/drivers');

const mockGetCurrentCoach = getCurrentCoach as jest.MockedFunction<typeof getCurrentCoach>;
const mockUpdateDriverProfile = updateDriverProfile as jest.MockedFunction<typeof updateDriverProfile>;
const mockGetDriverById = getDriverById as jest.MockedFunction<typeof getDriverById>;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/profile/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const coach = { id: 'coach-1', email: 'coach@example.com' } as Awaited<ReturnType<typeof getCurrentCoach>>;

const validBody = { driverId: 'driver-1', experienceLevel: 'intermediate' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/profile/update', () => {
  it('returns 401 when there is no coach', async () => {
    mockGetCurrentCoach.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    expect(mockUpdateDriverProfile).not.toHaveBeenCalled();
  });

  it('returns 403 when the driver is not visible to the coach', async () => {
    mockGetCurrentCoach.mockResolvedValue(coach);
    mockGetDriverById.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(403);
    expect(mockUpdateDriverProfile).not.toHaveBeenCalled();
  });

  it('returns 200 and updates the profile when the driver is visible', async () => {
    mockGetCurrentCoach.mockResolvedValue(coach);
    mockGetDriverById.mockResolvedValue({
      data: { id: 'driver-1', name: 'Driver One', email: 'd1@example.com' },
      error: null,
    });
    mockUpdateDriverProfile.mockResolvedValue({
      data: {
        id: 'profile-1',
        driver_id: 'driver-1',
        experience_level: 'intermediate',
        total_sessions: 5,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      },
      error: null,
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockUpdateDriverProfile).toHaveBeenCalledWith('driver-1', 'intermediate');
    expect(json.success).toBe(true);
    expect(json.profile.experienceLevel).toBe('intermediate');
  });
});
