export const SOCIAL_KINDS = [
  { value: 'soundcloud', label: 'SoundCloud' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'bandcamp', label: 'Bandcamp' },
  { value: 'beatport', label: 'Beatport' },
  { value: 'mixcloud', label: 'Mixcloud' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
] as const;

export type RigSocial = {
  kind: string;
  label?: string | null;
  url: string;
  enabled: boolean;
  sortOrder: number;
};

export function detectSocialKindFromUrl(url: string): string | null {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('soundcloud.com')) return 'soundcloud';
  if (lowerUrl.includes('spotify.com')) return 'spotify';
  if (lowerUrl.includes('music.apple.com') || lowerUrl.includes('apple.com/apple-music')) return 'apple_music';
  if (lowerUrl.includes('bandcamp.com')) return 'bandcamp';
  if (lowerUrl.includes('beatport.com')) return 'beatport';
  if (lowerUrl.includes('mixcloud.com')) return 'mixcloud';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'x';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  return null;
}

export function getSocialLabel(social: Pick<RigSocial, 'kind' | 'label' | 'url'>) {
  const detectedKind = social.url ? detectSocialKindFromUrl(social.url) : null;
  const actualKind = detectedKind || social.kind;

  if (actualKind === 'other' && social.label?.trim()) {
    return social.label.trim();
  }
  return SOCIAL_KINDS.find((k) => k.value === actualKind)?.label ?? actualKind;
}

export function getEnabledSocials(socials: RigSocial[] | undefined) {
  if (!socials?.length) return [];
  return [...socials]
    .filter((social) => social.enabled && social.url.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

