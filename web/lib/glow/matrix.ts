export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function labelFromPosition(row: number, col: number): string {
  const rowLabel = String.fromCharCode(65 + row);
  return `${rowLabel}${col + 1}`;
}

export function getRealtimeUrl() {
  const envUrl = process.env.NEXT_PUBLIC_REALTIME_URL;

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const envPointsToLocalhost =
      !envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    const pageIsNotLocalhost = hostname !== 'localhost' && hostname !== '127.0.0.1';

    if (envPointsToLocalhost && pageIsNotLocalhost) {
      return `${protocol}//${hostname}:4000`;
    }
  }

  return envUrl ?? 'http://localhost:4000';
}
