import type { WebrtcSignal } from './types';

/** STUN servers for NAT discovery (LAN + basic cross-NAT). */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * ICE server configuration. STUN-only for Phases 1-3.
 * Phase 4 adds TURN via env without changing call-site APIs.
 */
export function getGlowIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...STUN_SERVERS];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}

export const VISUALS_VIEWER_ID = 'visuals';

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: getGlowIceServers() });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate.toJSON());
    }
  };

  return pc;
}

export function addLocalTracks(pc: RTCPeerConnection, stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
}

export async function createPublisherOffer(pc: RTCPeerConnection): Promise<string> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer.sdp ?? '';
}

export async function applyRemoteDescription(
  pc: RTCPeerConnection,
  type: 'offer' | 'answer',
  sdp: string
): Promise<void> {
  await pc.setRemoteDescription({ type, sdp });
}

export async function createViewerAnswer(pc: RTCPeerConnection, offerSdp: string): Promise<string> {
  await applyRemoteDescription(pc, 'offer', offerSdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer.sdp ?? '';
}

export async function addIceCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  if (!candidate.candidate) return;
  try {
    await pc.addIceCandidate(candidate);
  } catch {
    // ICE can arrive before remote description is set; ignore transient errors
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function closePeerConnection(pc: RTCPeerConnection | null | undefined): void {
  if (!pc) return;
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.onconnectionstatechange = null;
  pc.close();
}

export type SignalEmitter = (signal: WebrtcSignal) => void;

export async function requestPublisherMedia(withAudio: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: withAudio,
  });
}

export type LiveLayoutPreset = 'pip' | 'half' | '2x2' | '3x3';

/** Single-cam PiP — bottom-right quarter so visuals stay the hero. */
export function buildSinglePublisherTile(
  publicId: string,
  style: 'pip' | 'half' = 'pip'
): { publicId: string; x: number; y: number; w: number; h: number; z: number } {
  if (style === 'half') {
    return { publicId, x: 0, y: 0.5, w: 1, h: 0.5, z: 1 };
  }
  return { publicId, x: 0.72, y: 0.72, w: 0.26, h: 0.26, z: 1 };
}

/** Grid layout presets for live-call mosaic (normalized 0-1 coordinates). */
export function buildLayoutPreset(
  publicIds: string[],
  preset: LiveLayoutPreset
): Array<{ publicId: string; x: number; y: number; w: number; h: number; z: number }> {
  const ids = publicIds.filter(Boolean);
  if (ids.length === 0) return [];

  if (ids.length === 1) {
    if (preset === 'pip' || preset === 'half') {
      return [buildSinglePublisherTile(ids[0]!, preset)];
    }
  }

  const cols = preset === '3x3' ? 3 : 2;
  const rows = preset === '3x3' ? 3 : 2;
  const slotCount = cols * rows;
  const tileW = 1 / cols;
  const tileH = 1 / rows;

  return ids.slice(0, slotCount).map((publicId, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      publicId,
      x: col * tileW,
      y: row * tileH,
      w: tileW,
      h: tileH,
      z: 1,
    };
  });
}
