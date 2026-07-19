const PUBLIC_PREFIXES = ['/login', '/auth/confirm'];

export function isPublicPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isApiPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return pathname === '/api' || pathname.startsWith('/api/');
}
