'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoomStatePayload } from '@/lib/glow/types';

type DeviceListProps = {
  roomState: RoomStatePayload;
  onIdentify: (publicId: string) => void;
};

export function DeviceList({ roomState, onIdentify }: DeviceListProps) {
  return (
    <Card className="border-white/10 bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="text-base">
          Devices ({roomState.devices.length}/{roomState.entitlements.maxDevices})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {roomState.devices.length === 0 ? (
          <p className="text-sm text-zinc-400">Waiting for players to join...</p>
        ) : (
          roomState.devices.map((device) => (
            <div
              key={device.publicId}
              className="flex items-center justify-between rounded-lg border border-white/10 p-3"
            >
              <div>
                <p className="font-medium">{device.nickname ?? 'Anonymous player'}</p>
                <p className="text-xs text-zinc-400">
                  {device.label ?? 'No position'} · {device.status}
                  {device.latencyMs !== undefined ? ` · ${device.latencyMs}ms` : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onIdentify(device.publicId)}>
                Identify
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
