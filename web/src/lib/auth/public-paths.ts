const PUBLIC_PREFIXES = ['/login', '/auth/callback'];

export function isPublicPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
