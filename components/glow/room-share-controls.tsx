'use client';

import { useMemo, useState } from 'react';
import { Download, QrCode, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';

type RoomShareControlsProps = {
  roomCode: string;
  matrixEnabled: boolean;
  onMatrixEnabledChange: (enabled: boolean) => void;
  compact?: boolean;
};

export function RoomShareControls({
  roomCode,
  matrixEnabled,
  onMatrixEnabledChange,
  compact = false,
}: RoomShareControlsProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(
    () => buildPlayerJoinUrl(roomCode, { matrix: matrixEnabled }),
    [roomCode, matrixEnabled]
  );

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function openQrWindow() {
    const params = new URLSearchParams();
    params.set('matrix', matrixEnabled ? '1' : '0');
    window.open(
      `/room/${roomCode.toUpperCase()}/qr?${params.toString()}`,
      '_blank',
      'noopener,noreferrer,width=720,height=820'
    );
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
      <Button type="button" variant="outline" size="sm" onClick={openQrWindow}>
        <QrCode className="mr-2 h-4 w-4" />
        View QR
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void downloadQr()}>
        <Download className="mr-2 h-4 w-4" />
        Download QR
      </Button>
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {actions}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={matrixEnabled}
            onChange={(e) => onMatrixEnabledChange(e.target.checked)}
            className="rounded border-white/20 bg-zinc-800"
          />
          <span>Require matrix position in join link</span>
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actions}
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
    </div>
  );
}
