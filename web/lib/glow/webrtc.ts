import type { WebrtcSignal } from './types';

/** STUN servers for NAT discovery (LAN + basic cross-NAT). */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type GlowIceConfig = {
  iceServers: RTCIceServer[];
  iceTransportPolicy: RTCIceTransportPolicy;
};

let cachedIceConfig: GlowIceConfig | null = null;
let iceConfigPromise: Promise<GlowIceConfig> | null = null;

function stunOnlyConfig(): GlowIceConfig {
  return { iceServers: [...STUN_SERVERS], iceTransportPolicy: 'all' };
}

/** Fetch ICE config from server route (TURN credentials injected at runtime). */
export async function fetchGlowIceConfig(): Promise<GlowIceConfig> {
  if (cachedIceConfig) return cachedIceConfig;
  if (iceConfigPromise) return iceConfigPromise;

  iceConfigPromise = (async () => {
    try {
      const res = await fetch('/api/webrtc/ice-servers', { cache: 'no-store' });
      if (!res.ok) {
        cachedIceConfig = stunOnlyConfig();
        return cachedIceConfig;
      }
      const data = (await res.json()) as GlowIceConfig;
      cachedIceConfig = {
        iceServers: Array.isArray(data.iceServers) ? data.iceServers : STUN_SERVERS,
        iceTransportPolicy: data.iceTransportPolicy === 'relay' ? 'relay' : 'all',
      };
      return cachedIceConfig;
    } catch {
      cachedIceConfig = stunOnlyConfig();
      return cachedIceConfig;
    } finally {
      iceConfigPromise = null;
    }
  })();

  return iceConfigPromise;
}

/** Invalidate cached ICE config (e.g. after env change in dev). */
export function invalidateGlowIceConfigCache(): void {
  cachedIceConfig = null;
  iceConfigPromise = null;
}

export const VISUALS_VIEWER_ID = 'visuals';

export type PeerConnectionHandlers = {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onTrack?: (event: RTCTrackEvent) => void;
};

export async function createPeerConnection(
  handlers: PeerConnectionHandlers
): Promise<RTCPeerConnection> {
  const config = await fetchGlowIceConfig();
  const pc = new RTCPeerConnection({
    iceServers: config.iceServers,
    iceTransportPolicy: config.iceTransportPolicy,
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      handlers.onIceCandidate(event.candidate.toJSON());
    }
  };

  if (handlers.onIceConnectionStateChange) {
    pc.oniceconnectionstatechange = () => {
      handlers.onIceConnectionStateChange?.(pc.iceConnectionState);
    };
  }

  if (handlers.onConnectionStateChange) {
    pc.onconnectionstatechange = () => {
      handlers.onConnectionStateChange?.(pc.connectionState);
    };
  }

  if (handlers.onTrack) {
    pc.ontrack = handlers.onTrack;
  }

  return pc;
}

export function addLocalTracks(pc: RTCPeerConnection, stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
}

export async function createPublisherOffer(
  pc: RTCPeerConnection,
  options?: { iceRestart?: boolean }
): Promise<string> {
  const offer = await pc.createOffer({ iceRestart: options?.iceRestart ?? false });
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

export async function createViewerAnswer(
  pc: RTCPeerConnection,
  offerSdp: string
): Promise<string> {
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
  pc.oniceconnectionstatechange = null;
  pc.close();
}

export type SignalEmitter = (signal: WebrtcSignal) => void;

export async function requestPublisherMedia(withAudio: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false, // Forcing video-only publisher (no mic prompt)
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
