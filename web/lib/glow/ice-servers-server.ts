import 'server-only';

export type GlowIceConfig = {
  iceServers: RTCIceServer[];
  iceTransportPolicy: RTCIceTransportPolicy;
};

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function parseTurnUrls(): string[] {
  const urls: string[] = [];
  const multi = process.env.TURN_URLS?.trim();
  const single = process.env.TURN_URL?.trim();

  if (multi) {
    try {
      const parsed = JSON.parse(multi) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string' && entry.trim()) {
            urls.push(entry.trim());
          }
        }
      }
    } catch {
      for (const part of multi.split(',')) {
        const trimmed = part.trim();
        if (trimmed) urls.push(trimmed);
      }
    }
  }

  if (single) urls.push(single);

  return [...new Set(urls)];
}

function resolveIceTransportPolicy(): RTCIceTransportPolicy {
  if (process.env.TURN_RELAY_ONLY === 'true') return 'relay';
  const policy = process.env.WEBRTC_ICE_TRANSPORT_POLICY?.trim().toLowerCase();
  if (policy === 'relay') return 'relay';
  return 'all';
}

/** Server-side ICE config from env (TURN credentials stay server-side until fetched). */
export function getGlowIceConfigServer(): GlowIceConfig {
  const iceServers: RTCIceServer[] = [...STUN_SERVERS];
  const turnUrls = parseTurnUrls();
  const username = process.env.TURN_USERNAME?.trim();
  const credential = process.env.TURN_CREDENTIAL?.trim();

  if (turnUrls.length > 0 && username && credential) {
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0]! : turnUrls,
      username,
      credential,
    });
  }

  return {
    iceServers,
    iceTransportPolicy: resolveIceTransportPolicy(),
  };
}
