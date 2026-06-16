'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { captureClientEvent } from '@/lib/posthog-client';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow, Tooltip } from '@/components/ui/neon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MockAd } from '@/components/glow/mock-ad';
import { UpgradeModal } from '@/components/glow/upgrade-modal';
import { useGlowSocket } from '@/lib/glow/socket';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import {
  buildLimitBody,
  buildLimitTitle,
  formatDeviceCap,
  getNextPlanForDevices,
} from '@/lib/plans/plan-meta';
import { createClient } from '@/lib/supabase/client';
import type { PlanEntitlements } from '@/lib/glow/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ROOM_CREATE_MODE_TIP_KEY = 'glow:room-create-mode-tip-seen';

const MATRIX_MODE_TOOLTIP = (
  <>
    <p>
      <strong className="font-cyber text-[10px] uppercase tracking-wide text-foreground">
        Unified strobe (default)
      </strong>
      {' — '}
      Leave matrix off. Every phone flashes the same color in sync — best when guests hold
      their devices or move around.
    </p>
    <p className="mt-2">
      <strong className="font-cyber text-[10px] uppercase tracking-wide text-foreground">
        Grid matrix
      </strong>
      {' — '}
      Only enable when phones stay in fixed positions forming a visual grid — waves and
      spatial patterns.
    </p>
  </>
);

type Rig = {
  id: string;
  name: string;
  palette: string[];
  isDefault: boolean;
};

export default function CreateRoomPage() {
  const router = useRouter();
  const { data, isLoading, mutate: mutateTeam } = useSWR<{
    team: { id: string; plan: { code: string } } | null;
    entitlements: PlanEntitlements;
  }>('/api/team', fetcher);
  const { data: rigsList } = useSWR<Rig[]>('/api/rigs', fetcher);
  
  const { emitWithCallback, connected } = useGlowSocket();
  const [positionRequired, setPositionRequired] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [selectedRigId, setSelectedRigId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [showModeTip, setShowModeTip] = useState(false);
  const [coverageAck, setCoverageAck] = useState(false);
  const [coverageError, setCoverageError] = useState(false);
  const searchParams = useSearchParams();
  const { team, mutate: mutateEntitlements } = useTeamEntitlements();

  const entitlements = data?.entitlements;
  const adsEnabled = entitlements?.adsEnabled ?? true;
  const maxGridRows = entitlements?.maxGridRows ?? 5;
  const maxGridCols = entitlements?.maxGridCols ?? 5;
  const maxMatrixCells = entitlements?.maxMatrixCells ?? entitlements?.maxDevices ?? 10;
  const matrixCells = positionRequired ? rows * cols : 1;
  const matrixTooLarge = positionRequired && matrixCells > maxMatrixCells;
  // Plan ∞: exige confirmar cobertura de red antes de abrir sala (el aforo masivo
  // depende de la cobertura de la zona, no del servidor). Ver docs/plans.md.
  const requiresCoverageAck = entitlements?.requiresCoverageAck ?? false;

  function clampRows(value: number) {
    return Math.min(Math.max(1, value), maxGridRows);
  }

  function clampCols(value: number) {
    return Math.min(Math.max(1, value), maxGridCols);
  }

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      void mutateEntitlements();
      void mutateTeam();
      const params = new URLSearchParams(searchParams.toString());
      params.delete('checkout');
      const next = params.toString();
      router.replace(next ? `/room/new?${next}` : '/room/new', { scroll: false });
    }
  }, [searchParams, mutateEntitlements, mutateTeam, router]);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(ROOM_CREATE_MODE_TIP_KEY) === '1';
      if (!seen) {
        setShowModeTip(true);
        localStorage.setItem(ROOM_CREATE_MODE_TIP_KEY, '1');
      }
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }, []);

  // Auto-select default rig on load
  useEffect(() => {
    if (rigsList && rigsList.length > 0 && !selectedRigId) {
      const defaultRig = rigsList.find((r) => r.isDefault) || rigsList[0];
      setSelectedRigId(defaultRig.id);
    }
  }, [rigsList, selectedRigId]);

  async function createRoom() {
    setCreating(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push('/auth/signin?redirect=/room/new');
        return;
      }

      const selectedRig = rigsList?.find((r) => r.id === selectedRigId);

      const response = await emitWithCallback<{
        roomCode?: string;
        error?: string;
        reason?: string;
        maxMatrixCells?: number;
      }>('orchestrator:create_room', {
        accessToken: session.access_token,
        matrix: positionRequired ? { rows, cols } : { rows: 1, cols: 1 },
        rigId: selectedRigId,
        paletteSnapshot: selectedRig ? selectedRig.palette : undefined,
        // Plan ∞: el host confirmó haber comprobado la cobertura de red (advisory)
        coverageAck: requiresCoverageAck ? coverageAck : undefined,
      });

      if (response.error === 'ACTIVE_SESSION' && response.roomCode) {
        const resume = window.confirm(
          `You already have an active session (${response.roomCode}). Open the control desk?`
        );
        if (resume) {
          router.push(`/room/${response.roomCode}/control`);
        }
        return;
      }

      if (response.error || !response.roomCode) {
        if (response.reason === 'matrix_too_large' || response.error === 'matrix_too_large') {
          captureClientEvent('plan_limit_hit', {
            limit_key: 'matrix_too_large',
            plan_code: data?.team?.plan?.code ?? 'free',
            matrix_rows: rows,
            matrix_cols: cols,
            matrix_cells: rows * cols,
            max_matrix_cells: response.maxMatrixCells,
          });
          setUpgradeOpen(true);
        } else {
          alert(response.error ?? 'Failed to create room');
        }
        return;
      }

      captureClientEvent('room_created', {
        room_code: response.roomCode,
        matrix_enabled: positionRequired,
        matrix_rows: positionRequired ? rows : 1,
        matrix_cols: positionRequired ? cols : 1,
        rig_id: selectedRigId,
      });

      const matrixQuery = positionRequired ? 'matrix=1' : 'matrix=0';
      router.push(`/room/${response.roomCode}/control?${matrixQuery}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create room';
      alert(message);
      setCreating(false);
      setPendingCreate(false);
    }
  }

  function handleCreateClick() {
    if (requiresCoverageAck && !coverageAck) {
      setCoverageError(true);
      return;
    }
    if (matrixTooLarge) {
      captureClientEvent('plan_limit_hit', {
        limit_key: 'matrix_too_large',
        plan_code: data?.team?.plan?.code ?? 'free',
        matrix_rows: rows,
        matrix_cols: cols,
        matrix_cells: matrixCells,
      });
      setUpgradeOpen(true);
      return;
    }
    if (adsEnabled) {
      setShowAd(true);
      setPendingCreate(true);
      return;
    }
    void createRoom();
  }

  // Suggest the next tier that actually fits a bigger grid (matrix cells === devices).
  const matrixPlan = getNextPlanForDevices(maxMatrixCells);
  const hasActiveSubscription =
    team?.subscriptionStatus === 'active' || team?.subscriptionStatus === 'trialing';

  return (
    <main className="relative mx-auto max-w-lg px-6 py-12 min-h-[100dvh] flex flex-col justify-center overflow-hidden">
      <SectionGlow glowColor="magenta" position="center" />

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title={buildLimitTitle('matrix_too_large', { rows, cols, matrixCells })}
        body={buildLimitBody('matrix_too_large', matrixPlan)}
        requiredPlan={matrixPlan}
        returnUrl="/room/new"
        hasActiveSubscription={hasActiveSubscription}
        secondaryLabel="Adjust grid size"
      />

      {showAd && pendingCreate ? (
        <MockAd
          placement="room_create"
          onComplete={() => {
            setShowAd(false);
            void createRoom();
          }}
          onTrack={() => {
            void fetch('/api/ads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ placement: 'room_create', viewerType: 'orchestrator' }),
            });
          }}
        />
      ) : null}

      <PageTransitionWrapper>
        <NeonCard glowColor="magenta" borderVariant="magenta" className="p-8">
          <div className="text-center mb-8">
            <NeonTitle as="h2" color="magenta" className="text-2xl font-black tracking-widest animate-pulse">
              GLOW YOUR RAVE
            </NeonTitle>
            <p className="text-[10px] font-cyber tracking-widest text-muted-foreground uppercase mt-1">
              SET UP THE LIGHTROOM GRID
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-white/5 dark:bg-white/5 bg-zinc-50 p-4 transition-all duration-300">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={positionRequired}
                  onChange={(e) => setPositionRequired(e.target.checked)}
                  className="mt-1 rounded-full border-border bg-transparent text-neon-magenta focus:ring-neon-magenta"
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-cyber text-sm font-semibold tracking-wide text-foreground">
                    Position phones in a fixed grid matrix?
                    {showModeTip ? (
                      <Tooltip
                        title="Which mode?"
                        color="cyan"
                        panelClassName="w-72"
                        content={MATRIX_MODE_TOOLTIP}
                      >
                        <button
                          type="button"
                          aria-label="Learn about unified strobe vs grid matrix"
                          className="inline-flex shrink-0 rounded-full text-neon-cyan transition-colors hover:text-neon-cyan/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon-cyan"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <HelpCircle className="size-3.5" />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground leading-normal">
                    {positionRequired
                      ? 'Each phone locks to a grid cell. Use only when devices stay in fixed positions for spatial patterns.'
                      : 'All devices flash in sync as one unified light — the default for handheld or moving devices. (Only recommended when you left the play devices ex. smartphones in a fixed position)'}
                  </div>
                </div>
              </label>
            </div>

            {positionRequired ? (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="rows" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">Grid Rows</Label>
                  <Input
                    id="rows"
                    type="number"
                    min={1}
                    max={maxGridRows}
                    value={rows}
                    onChange={(e) => setRows(clampRows(Number(e.target.value)))}
                    className="font-cyber tracking-wide text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cols" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">Grid Columns</Label>
                  <Input
                    id="cols"
                    type="number"
                    min={1}
                    max={maxGridCols}
                    value={cols}
                    onChange={(e) => setCols(clampCols(Number(e.target.value)))}
                    className="font-cyber tracking-wide text-center"
                  />
                </div>
              </div>
            ) : null}

            {rigsList && rigsList.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="rig-select" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">
                  Load Performance Rig
                </Label>
                <select
                  id="rig-select"
                  value={selectedRigId || ''}
                  onChange={(e) => setSelectedRigId(e.target.value || null)}
                  className="w-full h-10 bg-black/30 border border-white/10 rounded-lg text-white font-cyber px-3 focus:ring-1 focus:ring-neon-magenta focus:border-neon-magenta focus:outline-none text-xs uppercase tracking-wider"
                >
                  <option value="" className="bg-zinc-900 text-white">Default / Branded Rig</option>
                  {rigsList.map((rig) => (
                    <option key={rig.id} value={rig.id} className="bg-zinc-900 text-white">
                      {rig.name} {rig.isDefault ? '(DEFAULT)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground font-sans leading-normal">
                  Rigs load your preset cue lists, custom color palettes, and social links. Manage them under{' '}
                  <Link href="/rigs" className="text-neon-magenta hover:underline font-cyber tracking-wide text-[9px] uppercase">
                    Rigs Manager
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            <p className="text-xs font-cyber tracking-wide text-muted-foreground text-center">
              Rave Limit: {formatDeviceCap(entitlements?.maxDevices ?? 15)} synced screens
              {positionRequired
                ? ` · max ${maxMatrixCells} matrix cells · grid up to ${maxGridRows}×${maxGridCols}`
                : ''}
            </p>
            {matrixTooLarge ? (
              <p className="text-xs font-cyber tracking-wide text-red-400 text-center">
                {rows}×{cols} = {matrixCells} cells — exceeds your plan limit of {maxMatrixCells}
              </p>
            ) : null}

            {requiresCoverageAck ? (
              <div
                className={`rounded-xl border p-4 transition-colors ${
                  coverageError && !coverageAck
                    ? 'border-amber-400/60 bg-amber-400/10'
                    : 'border-amber-400/20 bg-amber-400/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div className="flex flex-col gap-2">
                    <span className="font-cyber text-xs font-semibold uppercase tracking-wide text-amber-300">
                      Massive crowd — check your coverage
                    </span>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      With unlimited devices, the show depends on the venue&apos;s network
                      coverage. If the area has weak signal or congestion, some devices
                      won&apos;t sync cleanly. Test the connectivity before you go live.
                    </p>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={coverageAck}
                        onChange={(e) => {
                          setCoverageAck(e.target.checked);
                          if (e.target.checked) setCoverageError(false);
                        }}
                        className="mt-0.5 rounded border-border bg-transparent text-amber-400 focus:ring-amber-400"
                      />
                      <span className="text-xs font-medium leading-snug text-foreground">
                        I understand the risks and I&apos;ve checked the venue&apos;s connectivity / coverage.
                      </span>
                    </label>
                    {coverageError && !coverageAck ? (
                      <span className="text-[10px] font-cyber uppercase tracking-wide text-amber-400">
                        Tick the box to launch the room.
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <NeonButton
              onClick={handleCreateClick}
              color="magenta"
              variant="solid"
              className="w-full text-xs uppercase tracking-widest h-11"
              disabled={creating || !connected || isLoading}
            >
              {creating
                ? 'DEPLOYING RIG...'
                : isLoading
                  ? 'LOADING DETAILS...'
                  : !connected
                    ? 'CONNECTING TO REALTIME…'
                    : 'LAUNCH RAVE LIGHTSHOW'}
            </NeonButton>
            {!connected ? (
              <p className="text-[10px] font-cyber tracking-wide text-muted-foreground text-center">
                Waiting for the realtime service on port 4000…
              </p>
            ) : null}
          </div>
        </NeonCard>
      </PageTransitionWrapper>
    </main>
  );
}
