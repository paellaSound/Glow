'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import type { RoomStatePayload } from '@/lib/glow/types';

type DeviceListProps = {
  roomState: RoomStatePayload;
  onIdentify: (publicId: string) => void;
};

export function DeviceList({ roomState, onIdentify }: DeviceListProps) {
  const { teamEntitlements } = useTeamEntitlements();
  const maxDevices = mergeEntitlementsForUi(roomState.entitlements, teamEntitlements).maxDevices;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Devices ({roomState.devices.length}/{maxDevices})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {roomState.devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting for players to join...</p>
        ) : (
          roomState.devices.map((device) => (
            <div
              key={device.publicId}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3 dark:border-white/10"
            >
              <div>
                <p className="font-medium">{device.nickname ?? 'Anonymous player'}</p>
                <p className="text-xs text-muted-foreground">
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
