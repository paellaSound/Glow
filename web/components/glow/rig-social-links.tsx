import { getEnabledSocials, getSocialLabel, type RigSocial } from '@/lib/glow/social-kinds';
import { cn } from '@/lib/utils';

type RigSocialLinksProps = {
  socials?: RigSocial[];
  variant?: 'light' | 'dark';
  className?: string;
};

export function RigSocialLinks({
  socials,
  variant = 'light',
  className,
}: RigSocialLinksProps) {
  const enabledSocials = getEnabledSocials(socials);

  if (enabledSocials.length === 0) return null;

  const isLight = variant === 'light';

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      {enabledSocials.map((social) => (
        <a
          key={`${social.kind}-${social.url}-${social.sortOrder}`}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            isLight
              ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
              : 'border-white/15 bg-white/5 text-zinc-200 hover:border-white/25 hover:bg-white/10'
          )}
        >
          {getSocialLabel(social)}
        </a>
      ))}
    </div>
  );
}
