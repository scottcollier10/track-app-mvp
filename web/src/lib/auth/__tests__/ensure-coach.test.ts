import { ensureCoach, type CoachRepo } from '../ensure-coach';

function makeRepo(overrides: Partial<CoachRepo> = {}): CoachRepo {
  return {
    findByAuthUserId: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    linkAuthUser: jest.fn().mockImplementation(async (id) => ({ id, name: 'X', email: 'x@x.com' })),
    create: jest.fn().mockResolvedValue({ id: 'new-id', name: 'scott', email: 's@x.com' }),
    ...overrides,
  };
}

const user = { id: 'auth-1', email: 'scott@example.com' };

describe('ensureCoach', () => {
  it('returns existing coach already linked to auth user', async () => {
    const coach = { id: 'c-1', name: 'Scott', email: 'scott@example.com' };
    const repo = makeRepo({ findByAuthUserId: jest.fn().mockResolvedValue(coach) });
    expect(await ensureCoach(repo, user)).toEqual(coach);
    expect(repo.findByEmail).not.toHaveBeenCalled();
  });

  it('links an existing coach row by email on first login', async () => {
    const coach = { id: 'c-2', name: 'Scott', email: 'scott@example.com' };
    const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue(coach) });
    await ensureCoach(repo, user);
    expect(repo.linkAuthUser).toHaveBeenCalledWith('c-2', 'auth-1');
  });

  it('creates a coach when no match exists', async () => {
    const repo = makeRepo();
    await ensureCoach(repo, user);
    expect(repo.create).toHaveBeenCalledWith({
      name: 'scott',
      email: 'scott@example.com',
      auth_user_id: 'auth-1',
    });
  });

  it('throws when auth user has no email', async () => {
    await expect(ensureCoach(makeRepo(), { id: 'auth-1', email: undefined })).rejects.toThrow();
  });
});
