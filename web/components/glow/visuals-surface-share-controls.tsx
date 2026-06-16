'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Download, ExternalLink, QrCode, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShareIconTrigger } from '@/components/glow/share-icon-trigger';

type VisualsSurfaceShareControlsProps = {
  roomCode: string;
  connected: boolean;
  segmentActive?: boolean;
  onSurfaceOpened?: () => void;
};

export function VisualsSurfaceShareControls({
  roomCode,
  connected,
  segmentActive = false,
  onSurfaceOpened,
}: VisualsSurfaceShareControlsProps) {
  const [copied, setCopied] = useState(false);
  const [minting, setMinting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function mintToken(): Promise<string | null> {
    setMinting(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode.toUpperCase()}/visuals-token`, {
        method: 'POST',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string; token: string; expiresAt: string };
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      setShareUrl(fullUrl);
      onSurfaceOpened?.();
      const dataUrl = await QRCode.toDataURL(fullUrl, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      return fullUrl;
    } catch (err) {
      alert(
        `Could not mint visuals token: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      return null;
    } finally {
      setMinting(false);
    }
  }

  async function ensureShareUrl(): Promise<string | null> {
    if (shareUrl) return shareUrl;
    return mintToken();
  }

  async function copyShareLink() {
    const url = await ensureShareUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function openInNewTab() {
    const url = await ensureShareUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function openQrModal() {
    await ensureShareUrl();
    setQrModalOpen(true);
  }

  async function downloadQr() {
    const url = await ensureShareUrl();
    if (!url) return;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `glow-${roomCode.toUpperCase()}-visuals-qr.png`;
    link.click();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ShareIconTrigger
            copied={copied}
            copiedLabel="Copied!"
            embedded
            segmentActive={segmentActive}
            disabled={!connected || minting}
            label={minting ? '…' : 'Share'}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <div className="flex gap-2 border-b border-white/10 px-2 py-2.5 text-[11px] leading-snug text-amber-100/90">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden />
            <p>
              For whoever will <strong className="font-semibold">project visuals</strong> — not party
              guests. Same-account sign-in required.
            </p>
          </div>
          <DropdownMenuItem onClick={() => void copyShareLink()} disabled={!connected || minting}>
            <Share2 className="h-4 w-4" />
            Copy projector link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openQrModal()} disabled={!connected || minting}>
            <QrCode className="h-4 w-4" />
            View QR
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openInNewTab()} disabled={!connected || minting}>
            <ExternalLink className="h-4 w-4" />
            Open visuals in new tab
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void downloadQr()} disabled={!connected || minting}>
            <Download className="h-4 w-4" />
            Download QR
          </DropdownMenuItem>
          {shareUrl ? (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-[9px] font-mono leading-relaxed text-zinc-500 break-all">
                {shareUrl}
              </p>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {mounted && qrModalOpen && qrDataUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setQrModalOpen(false)}
            >
              <div
                className="relative my-auto w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setQrModalOpen(false)}
                  className="absolute right-4 top-4 rounded-full border border-white/10 p-1.5 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
                  aria-label="Close QR preview"
                >
                  <X className="h-4 w-4" />
                </button>

                <p className="mb-4 pr-8 text-xs font-cyber uppercase tracking-widest text-zinc-400">
                  Visuals projector QR
                </p>
                <div className="flex justify-center">
                  <img
                    src={qrDataUrl}
                    alt="Visuals surface QR code"
                    className="size-56 rounded-xl bg-white p-2"
                  />
                </div>
                <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-500">
                  Scan on the machine that will run the visuals surface. Same-account sign-in required.
                </p>

                <div className="mt-4 flex justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => void openInNewTab()}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open surface
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
