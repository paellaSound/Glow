import { SOCIAL_KINDS, type RigSocial, detectSocialKindFromUrl } from '@/lib/glow/social-kinds';
import { ArrowDown, ArrowUp, Plus, Trash } from 'lucide-react';

interface SocialLinksEditorProps {
  socials: RigSocial[];
  onChange: (next: RigSocial[]) => void;
  disabled?: boolean;
}

export function SocialLinksEditor({ socials, onChange, disabled }: SocialLinksEditorProps) {
  function addSocial() {
    const nextSortOrder = socials.length > 0 ? Math.max(...socials.map((s) => s.sortOrder)) + 1 : 0;
    onChange([
      ...socials,
      {
        kind: 'website',
        label: '',
        url: '',
        enabled: true,
        sortOrder: nextSortOrder,
      },
    ]);
  }

  function removeSocial(index: number) {
    const filtered = socials.filter((_, i) => i !== index);
    // Normalize sort orders
    const normalized = filtered.map((s, idx) => ({ ...s, sortOrder: idx }));
    onChange(normalized);
  }

  function updateSocial(index: number, patch: Partial<RigSocial>) {
    const updated = socials.map((s, i) => {
      if (i === index) {
        const next = { ...s, ...patch };
        // Auto-detect kind from URL if the user edits the URL and kind is not custom
        if (patch.url !== undefined) {
          const autoKind = detectSocialKindFromUrl(patch.url);
          if (autoKind) {
            next.kind = autoKind;
          }
        }
        return next;
      }
      return s;
    });
    onChange(updated);
  }

  function moveSocial(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= socials.length) return;

    const reordered = [...socials];
    const temp = reordered[index]!;
    reordered[index] = reordered[targetIndex]!;
    reordered[targetIndex] = temp;

    // Normalize sort orders based on indices
    const updated = reordered.map((s, idx) => ({ ...s, sortOrder: idx }));
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {socials.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-black/20">
          <p className="text-xs text-zinc-500 font-cyber uppercase tracking-wider">No social links added yet</p>
          <p className="text-[10px] text-zinc-600 mt-1">Add links to display them on the share QR code overlay.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {socials.map((social, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 p-4 rounded-xl border border-white/5 bg-black/40"
            >
              {/* Header: Kind select + enabled toggle + reorder / delete buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={social.kind}
                    onChange={(e) => updateSocial(index, { kind: e.target.value })}
                    disabled={disabled}
                    className="h-8 rounded-lg border border-white/10 bg-zinc-900/80 px-2 text-xs font-cyber text-white focus:border-neon-cyan/50 focus:outline-none text-left uppercase tracking-wider"
                  >
                    {SOCIAL_KINDS.map((k) => (
                      <option key={k.value} value={k.value} className="bg-zinc-900 text-white">
                        {k.label}
                      </option>
                    ))}
                  </select>

                  <label className="flex cursor-pointer items-center gap-1.5 select-none ml-2">
                    <input
                      type="checkbox"
                      checked={social.enabled}
                      onChange={(e) => updateSocial(index, { enabled: e.target.checked })}
                      disabled={disabled}
                      className="rounded border-white/10 bg-transparent text-neon-cyan focus:ring-neon-cyan"
                    />
                    <span className="text-[9px] font-cyber uppercase tracking-wider text-zinc-400">
                      {social.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSocial(index, -1)}
                    disabled={disabled || index === 0}
                    className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5 text-zinc-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSocial(index, 1)}
                    disabled={disabled || index === socials.length - 1}
                    className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5 text-zinc-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSocial(index)}
                    disabled={disabled}
                    className="flex size-7 items-center justify-center rounded-lg border border-red-950/20 bg-red-950/30 hover:bg-red-950/50"
                    title="Remove"
                  >
                    <Trash className="size-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* URL and Label inputs */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-[9px] font-cyber text-zinc-500 uppercase tracking-widest mb-1">
                    URL Link
                  </label>
                  <input
                    type="url"
                    value={social.url}
                    onChange={(e) => updateSocial(index, { url: e.target.value })}
                    placeholder="https://soundcloud.com/username"
                    disabled={disabled}
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-zinc-700 focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>

                {social.kind === 'other' ? (
                  <div>
                    <label className="block text-[9px] font-cyber text-zinc-500 uppercase tracking-widest mb-1">
                      Label Name
                    </label>
                    <input
                      type="text"
                      value={social.label || ''}
                      onChange={(e) => updateSocial(index, { label: e.target.value })}
                      placeholder="My Custom Link"
                      disabled={disabled}
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-zinc-700 focus:border-neon-cyan/50 focus:outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addSocial}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-white/10 hover:border-neon-cyan/30 rounded-xl bg-white/5 hover:bg-neon-cyan/5 text-[10px] font-cyber uppercase tracking-wider text-zinc-300 transition-colors"
      >
        <Plus className="size-3.5 text-neon-cyan" />
        Add Social Link
      </button>
    </div>
  );
}
