'use client';

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { buildPlayerJoinUrl, parseMatrixParam } from '@/lib/glow/join-url';

function QrContent({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const matrixEnabled = parseMatrixParam(searchParams.get('matrix'));
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const joinUrl = useMemo(
    () => buildPlayerJoinUrl(code, { matrix: matrixEnabled }),
    [code, matrixEnabled]
  );

  useEffect(() => {
    void QRCode.toDataURL(joinUrl, {
      width: 640,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setDataUrl);
  }, [joinUrl]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-white p-8 text-black">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Glow Room</p>
        <h1 className="mt-2 text-5xl font-bold tracking-widest">{code.toUpperCase()}</h1>
        <p className="mt-3 text-lg text-zinc-600">
          {matrixEnabled ? 'Scan to join and pick your position' : 'Scan to join'}
        </p>
      </div>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR code for room ${code.toUpperCase()}`}
          className="h-auto w-full max-w-[min(80vw,640px)] rounded-2xl border border-zinc-200 shadow-lg"
        />
      ) : (
        <div className="h-[min(80vw,640px)] w-[min(80vw,640px)] animate-pulse rounded-2xl bg-zinc-100" />
      )}

      <p className="max-w-xl break-all text-center text-sm text-zinc-500">{joinUrl}</p>
    </main>
  );
}

export default function RoomQrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-white" />}>
      <QrContent code={code} />
    </Suspense>
  );
}
