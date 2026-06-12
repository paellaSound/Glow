'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import type { RoomStatePayload } from '@/lib/glow/types';

type DeviceListProps = {
  roomState: RoomStatePayload;
  onIdentify: (publicId: string) => void;
  showOnboardingHint?: boolean;
};

export function DeviceList({ roomState, onIdentify, showOnboardingHint = false }: DeviceListProps) {
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
          <div className="rounded-lg border border-dashed border-neon-cyan/20 bg-neon-cyan/5 px-4 py-5 text-center">
            <p className="text-sm font-medium text-foreground">
              Share the QR — waiting for your first phone
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {showOnboardingHint
                ? 'Use Share or View QR in the header, then guests open the link on their phones.'
                : 'Guests join with the room link or QR code — no account needed.'}
            </p>
          </div>
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
