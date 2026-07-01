/** Decode JWT payload without verification (UI hints only — server enforces auth). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function roleFromToken(token: string | null): string {
  if (!token) return 'USER';
  const payload = decodeJwtPayload(token);
  return (payload?.role as string) ?? 'USER';
}

export function isPlatformAdmin(token: string | null): boolean {
  return roleFromToken(token) === 'PLATFORM_ADMIN';
}
