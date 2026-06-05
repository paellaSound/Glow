const STORAGE_PREFIX = 'glow_player_';

export function getStoredDeviceId(roomCode: string) {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${roomCode.toUpperCase()}`);
}

export function storeDeviceId(roomCode: string, devicePublicId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${roomCode.toUpperCase()}`, devicePublicId);
}

export function clearStoredDeviceId(roomCode: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${roomCode.toUpperCase()}`);
}
