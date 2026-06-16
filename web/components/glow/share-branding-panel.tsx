'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, Loader2, Megaphone, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { NeonButton } from '@/components/ui/neon';
import { SocialLinksEditor } from '@/components/glow/social-links-editor';
import { normalizeRigResponse, type RigWithCues } from '@/components/glow/visuals-tab';
import { rigLogoPublicUrl } from '@/lib/glow/player-chrome-config';
import type { RigSocial } from '@/lib/glow/social-kinds';
import type { PlanEntitlements } from '@/lib/glow/types';
import { cn } from '@/lib/utils';

type ShareBrandingPanelProps = {
  roomCode: string;
  loadedRig: RigWithCues | null;
  onLoadedRigChange: (rig: RigWithCues) => void;
  entitlements: PlanEntitlements;
  connected: boolean;
};

/**
 * Operator-facing editor for the branding shown when a guest scans/opens the
 * share (join) link: the show name, logo and social links. Lives as an option
 * in the control header so it is reachable from both desk tabs.
 */
export function ShareBrandingPanel({
  roomCode,
  loadedRig,
  onLoadedRigChange,
  entitlements,
  connected,
}: ShareBrandingPanelProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [socials, setSocials] = useState<RigSocial[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyLogo, setBusyLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Sync the editable copy from the loaded rig whenever the panel opens.
  useEffect(() => {
    if (!open || !loadedRig) return;
    const rawName = loadedRig.name?.trim() ?? '';
    setName(rawName.toLowerCase() === 'default' ? '' : rawName);
    setSocials(loadedRig.socials ?? []);
  }, [open, loadedRig?.id]);

  const rigId = loadedRig?.id ?? null;
  const logoUrl =
    loadedRig?.logo_asset_path && entitlements.customRigLogo
      ? rigLogoPublicUrl(loadedRig.logo_asset_path)
      : null;

  // Always refetch with relations so we never drop cues/socials from state.
  async function refreshRig() {
    if (!rigId) return;
    const res = await fetch(`/api/rigs/${rigId}`);
    if (res.ok) onLoadedRigChange(normalizeRigResponse(await res.json()));
  }

  async function saveBranding() {
    if (!rigId) return;
    setSaving(true);
    try {
      const promises: Promise<any>[] = [];

      // Save name
      promises.push(
        fetch(`/api/rigs/${rigId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() || 'Default' }),
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error ?? `Failed to save show name (HTTP ${res.status})`);
          }
        })
      );

      // Save socials
      if (entitlements.customQrBranding) {
        promises.push(
          fetch(`/api/rigs/${rigId}/socials`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ socials }),
          }).then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData?.error ?? `Failed to save social links (HTTP ${res.status})`);
            }
          })
        );
      }

      await Promise.all(promises);
      await refreshRig();
      toast.success('Branding changes saved');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save branding');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!rigId) return;
    setBusyLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/rigs/${rigId}/logo`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      // Enable the logo as soon as one is uploaded.
      await fetch(`/api/rigs/${rigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoEnabled: true }),
      });
      await refreshRig();
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload logo');
    } finally {
      setBusyLogo(false);
    }
  }

  async function toggleLogo(enabled: boolean) {
    if (!rigId) return;
    setBusyLogo(true);
    try {
      const res = await fetch(`/api/rigs/${rigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoEnabled: enabled }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      await refreshRig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update logo');
    } finally {
      setBusyLogo(false);
    }
  }

  return (
    <>
      <NeonButton
        color="violet"
        variant="outline"
        className="h-9 px-3 text-xs uppercase tracking-widest gap-1.5"
        onClick={() => setOpen(true)}
        disabled={!loadedRig}
      >
        <Megaphone className="size-3.5" />
        Branding
      </NeonButton>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div
                className="relative my-auto w-full max-w-lg rounded-2xl border border-neon-violet/30 bg-zinc-950 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 rounded-full border border-white/10 p-1.5 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
                  aria-label="Close branding editor"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="mb-5 pr-8">
                  <h3 className="flex items-center gap-2 text-sm font-cyber uppercase tracking-widest text-neon-violet">
                    <Megaphone className="size-4" />
                    Share branding
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Name, logo &amp; links shown when guests scan or open the join link.
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Show name */}
                  <section className="flex flex-col gap-2">
                    <label className="text-[10px] font-cyber uppercase tracking-widest text-zinc-400">
                      Show name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. NIGHTSHIFT"
                      maxLength={48}
                      className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-foreground focus:border-neon-violet/50 focus:outline-none"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Appears as “who is inviting you”. Leave blank to hide it.
                    </p>
                  </section>

                  {/* Logo */}
                  <section className="flex flex-col gap-2 border-t border-white/5 pt-5">
                    <label className="text-[10px] font-cyber uppercase tracking-widest text-zinc-400">
                      Logo
                    </label>
                    {entitlements.customRigLogo ? (
                      <div className="flex items-center gap-3">
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="Rig logo" className="size-full object-contain" />
                          ) : (
                            <ImageOff className="size-5 text-zinc-600" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadLogo(file);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busyLogo}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[10px] font-cyber uppercase tracking-widest text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
                          >
                            {busyLogo ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                            {logoUrl ? 'Replace logo' : 'Upload logo'}
                          </button>
                          {logoUrl ? (
                            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-400">
                              <input
                                type="checkbox"
                                checked={loadedRig?.logo_enabled ?? false}
                                onChange={(e) => void toggleLogo(e.target.checked)}
                                disabled={busyLogo}
                                className="rounded border-white/20 bg-transparent text-neon-violet focus:ring-neon-violet"
                              />
                              Show logo on the player screen
                            </label>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-zinc-500">
                        A custom logo requires a Venue plan or higher.
                      </p>
                    )}
                    {entitlements.customRigLogo && logoUrl ? (
                      <p className="text-[10px] leading-snug text-zinc-500">
                        Drag the logo to position it on the{' '}
                        <span className="text-zinc-300">Play Devices</span> preview (Edit layout).
                      </p>
                    ) : null}
                  </section>

                  {/* Social links */}
                  <section className="flex flex-col gap-3 border-t border-white/5 pt-5">
                    <label className="text-[10px] font-cyber uppercase tracking-widest text-zinc-400">
                      Social links
                    </label>
                    {entitlements.customQrBranding ? (
                      <SocialLinksEditor socials={socials} onChange={setSocials} disabled={!connected} />
                    ) : (
                      <p className={cn('rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-zinc-500')}>
                        Social links on the share QR require a Venue plan or higher.
                      </p>
                    )}
                  </section>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-3 border-t border-white/5 pt-5">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="h-9 px-4 rounded-lg border border-white/10 text-xs font-cyber uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                    >
                      Cancel
                    </button>
                    <NeonButton
                      type="button"
                      color="violet"
                      variant="solid"
                      className="h-9 px-5 text-xs uppercase tracking-widest"
                      onClick={() => void saveBranding()}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </NeonButton>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
