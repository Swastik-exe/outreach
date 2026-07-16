import type { SpringPage } from './types';

export function pageContent<T>(data: SpringPage<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.content ?? [];
}
