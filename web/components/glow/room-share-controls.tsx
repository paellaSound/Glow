'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, QrCode, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { RoomQrPanel } from '@/components/glow/room-qr-panel';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import type { RigSocial } from '@/lib/glow/social-kinds';

type RoomShareControlsProps = {
  roomCode: string;
  matrixEnabled: boolean;
  onMatrixEnabledChange: (enabled: boolean) => void;
  showMatrixOption?: boolean;
  compact?: boolean;
  onShareAction?: () => void;
};

type ShareInfo = {
  rigName: string | null;
  socials: RigSocial[];
  customQrBranding?: boolean;
  glowBrandName?: string;
};

export function RoomShareControls({
  roomCode,
  matrixEnabled,
  onMatrixEnabledChange,
  showMatrixOption = true,
  compact = false,
  onShareAction,
}: RoomShareControlsProps) {
  const [copied, setCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo>({ rigName: null, socials: [] });

  const joinUrl = useMemo(
    () => buildPlayerJoinUrl(roomCode, { matrix: matrixEnabled }),
    [roomCode, matrixEnabled]
  );

  useEffect(() => {
    if (!qrModalOpen) return;

    void fetch(`/api/rooms/${roomCode.toUpperCase()}/share-info`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ShareInfo | null) => {
        if (data) setShareInfo(data);
      })
      .catch(() => {
        setShareInfo({ rigName: null, socials: [] });
      });
  }, [qrModalOpen, roomCode]);

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    onShareAction?.();
    window.setTimeout(() => setCopied(false), 2000);
  }

  function buildQrPageUrl() {
    const params = new URLSearchParams();
    params.set('matrix', matrixEnabled ? '1' : '0');
    return `/room/${roomCode.toUpperCase()}/qr?${params.toString()}`;
  }

  function openQrInNewTab() {
    window.open(buildQrPageUrl(), '_blank', 'noopener,noreferrer');
  }

  async function downloadQr() {
    const dataUrl = await QRCode.toDataURL(joinUrl, {
      width: 1024,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `glow-${roomCode.toUpperCase()}-qr.png`;
    link.click();
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void copyJoinLink()}>
        <Share2 className="mr-2 h-4 w-4" />
        {copied ? 'Copied!' : 'Share'}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => { setQrModalOpen(true); onShareAction?.(); }}>
        <QrCode className="mr-2 h-4 w-4" />
        View QR
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={openQrInNewTab}>
        <ExternalLink className="mr-2 h-4 w-4" />
        Open QR in new tab
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void downloadQr()}>
        <Download className="mr-2 h-4 w-4" />
        Download QR
      </Button>
    </div>
  );

  return (
    <>
      {compact ? (
        <div className="flex flex-col gap-2" data-onboarding="share">
          {actions}
          {showMatrixOption ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={matrixEnabled}
                onChange={(e) => onMatrixEnabledChange(e.target.checked)}
                className="rounded border-white/20 bg-zinc-800"
              />
              <span>Require matrix position in join link</span>
            </label>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-onboarding="share">
          {actions}
          {showMatrixOption ? (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={matrixEnabled}
                  onChange={(e) => onMatrixEnabledChange(e.target.checked)}
                  className="rounded border-white/20 bg-zinc-800"
                />
                <span>Require matrix position in join link</span>
              </label>
              <p className="text-xs text-zinc-500">
                {matrixEnabled
                  ? 'Players will pick a cell when they open the link.'
                  : 'Players join directly without picking a matrix cell.'}
              </p>
            </>
          ) : null}
        </div>
      )}

      {qrModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
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

            <RoomQrPanel
              roomCode={roomCode}
              matrixEnabled={matrixEnabled}
              rigName={shareInfo.rigName}
              socials={shareInfo.socials}
              customQrBranding={shareInfo.customQrBranding ?? false}
              glowBrandName={shareInfo.glowBrandName}
              qrSize={480}
              variant="dark"
              showJoinUrl={false}
            />

            <div className="mt-4 flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={openQrInNewTab}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open fullscreen
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
