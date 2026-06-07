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

export function getSocialLabel(social: Pick<RigSocial, 'kind' | 'label'>) {
  if (social.kind === 'other' && social.label?.trim()) {
    return social.label.trim();
  }
  return SOCIAL_KINDS.find((k) => k.value === social.kind)?.label ?? social.kind;
}

export function getEnabledSocials(socials: RigSocial[] | undefined) {
  if (!socials?.length) return [];
  return [...socials]
    .filter((social) => social.enabled && social.url.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
