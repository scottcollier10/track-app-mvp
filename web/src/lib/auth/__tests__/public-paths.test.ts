import { isPublicPath } from '../public-paths';

describe('isPublicPath', () => {
  it.each(['/login', '/auth/callback', '/auth/callback?code=abc'])(
    'allows %s without auth',
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(['/', '/coach', '/drivers', '/import', '/sessions/123', '/api/sessions'])(
    'requires auth for %s',
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    }
  );
});
