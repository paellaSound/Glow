export function buildPlayerJoinUrl(
  code: string,
  options?: { matrix?: boolean; origin?: string }
) {
  const base = options?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams();
  params.set('matrix', options?.matrix === false ? '0' : '1');
  return `${base}/room/${code.toUpperCase()}/play?${params.toString()}`;
}

export function parseMatrixParam(value: string | null) {
  return value !== '0';
}
