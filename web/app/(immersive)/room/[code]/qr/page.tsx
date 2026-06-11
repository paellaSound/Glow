'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RoomQrPanel } from '@/components/glow/room-qr-panel';
import { parseMatrixParam } from '@/lib/glow/join-url';
import type { RigSocial } from '@/lib/glow/social-kinds';

type ShareInfo = {
  rigName: string | null;
  socials: RigSocial[];
};

function QrContent({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const matrixEnabled = parseMatrixParam(searchParams.get('matrix'));
  const [shareInfo, setShareInfo] = useState<ShareInfo>({ rigName: null, socials: [] });

  useEffect(() => {
    void fetch(`/api/rooms/${code.toUpperCase()}/share-info`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ShareInfo | null) => {
        if (data) setShareInfo(data);
      })
      .catch(() => {
        // Share branding is optional — QR still works without it.
      });
  }, [code]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white p-8 text-black">
      <RoomQrPanel
        roomCode={code}
        matrixEnabled={matrixEnabled}
        rigName={shareInfo.rigName}
        socials={shareInfo.socials}
      />
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
