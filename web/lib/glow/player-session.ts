const STORAGE_PREFIX = 'glow_player_';
const NICKNAME_PREFIX = 'glow_nickname_';

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

export function getStoredNickname(roomCode: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${NICKNAME_PREFIX}${roomCode.toUpperCase()}`);
}

export function storeNickname(roomCode: string, nickname: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${NICKNAME_PREFIX}${roomCode.toUpperCase()}`, nickname);
}

export function clearStoredNickname(roomCode: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${NICKNAME_PREFIX}${roomCode.toUpperCase()}`);
}

