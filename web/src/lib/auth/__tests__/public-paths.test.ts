import { isApiPath, isPublicPath } from '../public-paths';

describe('isPublicPath', () => {
  it.each([
    '/login',
    '/login/',
    '/auth/callback',
    '/auth/callback?code=abc',
    '/auth/confirm',
    '/auth/confirm?token_hash=abc&type=email',
  ])(
    'allows %s without auth',
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(['/', '/loginfoo', '/coach', '/drivers', '/import', '/sessions/123', '/api/sessions'])(
    'requires auth for %s',
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    }
  );
});

describe('isApiPath', () => {
  it.each(['/api/sessions', '/api/import-session', '/api/coaches/c-1/drivers'])(
    'treats %s as API',
    (path) => expect(isApiPath(path)).toBe(true)
  );
  it.each(['/', '/login', '/coach', '/apiary'])(
    'treats %s as non-API',
    (path) => expect(isApiPath(path)).toBe(false)
  );
});
