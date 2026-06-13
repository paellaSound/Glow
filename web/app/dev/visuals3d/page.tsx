'use client';

/**
 * Designer sandbox for 3D visuals — /dev/visuals3d.
 *
 * A scene is an energy curve of 6 levels. Each level owns its OWN GLB (drag-drop
 * to assign it to the selected level, or "use test GLB" for the bundled goku),
 * an HSL tonality (background + global tint), one looping idle clip and N
 * triggerable action clips. The runtime crossfades or cuts between levels' models
 * and the laptop mic drives modular audio bindings. "Export config" produces the
 * Scene3DConfig handoff; copy that + the GLB/HDR source files into the app.
 *
 * Not linked from anywhere; visit /dev/visuals3d directly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mountSandboxScene,
  MAX_ENERGY,
  ENERGY_LEVEL_COUNT,
  type AudioBinding,
  type AudioSource,
  type AudioTarget,
  type EnergyLevelConfig,
  type HSL,
  type SandboxController,
  type SandboxInput,
  type SceneInspection,
  type TransitionMode,
} from 'glow-visuals-3d';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';

const DEFAULT_PALETTE = ['#00e3ff', '#ff00c8', '#ffb300', '#7c4dff'];
const TEST_GLB_URL = '/visuals3d/goku.glb';

const AUDIO_SOURCES: AudioSource[] = ['bass', 'mid', 'treble', 'energy'];
const AUDIO_TARGETS: { id: AudioTarget; label: string }[] = [
  { id: 'scale', label: 'scale / pulse' },
  { id: 'emissive', label: 'glow (emissive)' },
  { id: 'bgHue', label: 'background hue' },
  { id: 'rotationY', label: 'rotation' },
  { id: 'animationSpeed', label: 'anim speed' },
];

const DEFAULT_BINDINGS: AudioBinding[] = [
  { source: 'bass', target: 'scale', amount: 0.15, smoothing: 0.5, enabled: true },
  { source: 'bass', target: 'emissive', amount: 1.0, smoothing: 0.4, enabled: true },
  { source: 'treble', target: 'animationSpeed', amount: 1.0, smoothing: 0.6, enabled: true },
];

function ext(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}

function emptyLevels(): EnergyLevelConfig[] {
  // A gentle ground→space hue/lightness ramp; the designer customizes per level.
  return Array.from({ length: ENERGY_LEVEL_COUNT }, (_, i) => ({
    glb: null,
    hsl: { h: 0.62, s: 0.55, l: 0.04 + (i / MAX_ENERGY) * 0.04 },
    idleClip: null,
    actions: [],
  }));
}

function hslToHex({ h, s, l }: HSL): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (tt: number) => {
      let t = tt;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = f(h + 1 / 3);
    g = f(h);
    b = f(h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hexToHsl(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

export default function Visuals3DSandboxPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<SandboxController | null>(null);
  const inputRef = useRef<SandboxInput>({ timeMs: 0, palette: DEFAULT_PALETTE, audio: undefined });

  const [levels, setLevels] = useState<EnergyLevelConfig[]>(emptyLevels());
  const [levelInspection, setLevelInspection] = useState<(SceneInspection | null)[]>(
    Array(ENERGY_LEVEL_COUNT).fill(null),
  );
  const [editingLevel, setEditingLevel] = useState(0);
  const [transitionMode, setTransitionMode] = useState<TransitionMode>('crossfade');

  const [hdrName, setHdrName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [paletteTargets, setPaletteTargets] = useState<string[]>([]);
  const [bindings, setBindings] = useState<AudioBinding[]>(DEFAULT_BINDINGS);
  const [exposure, setExposure] = useState(1);
  const [useHdrBg, setUseHdrBg] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { featuresRef, active: micActive, error: micError } = useAudioAnalyzer({ enabled: micOn });

  useEffect(() => {
    if (!canvasRef.current || controllerRef.current) return;
    controllerRef.current = mountSandboxScene(canvasRef.current, () => inputRef.current);
    const onResize = () => controllerRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    inputRef.current = { ...inputRef.current, palette };
  }, [palette]);

  useEffect(() => {
    if (!micActive) {
      inputRef.current = { ...inputRef.current, audio: undefined };
      return;
    }
    let raf = 0;
    const tick = () => {
      inputRef.current.audio = featuresRef.current;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [micActive, featuresRef]);

  useEffect(() => controllerRef.current?.setPaletteTargets(paletteTargets), [paletteTargets]);
  useEffect(() => controllerRef.current?.setAudioBindings(bindings), [bindings]);
  useEffect(() => controllerRef.current?.setEnergyLevels(levels), [levels]);
  useEffect(() => controllerRef.current?.setTransitionMode(transitionMode), [transitionMode]);
  useEffect(() => controllerRef.current?.setExposure(exposure), [exposure]);
  useEffect(() => controllerRef.current?.setUseHdrBackground(useHdrBg), [useHdrBg]);
  useEffect(() => controllerRef.current?.setEnergy(editingLevel), [editingLevel]);

  const loadGlbIntoLevel = useCallback(async (level: number, url: string, name: string) => {
    const controller = controllerRef.current;
    if (!controller) return;
    setError(null);
    setLoading(true);
    try {
      const found = await controller.loadGlbForLevel(level, url, name);
      const guessIdle = found.clips.find((c) => c.toLowerCase() === 'idle') ?? found.clips[0] ?? null;
      setLevelInspection((prev) => prev.map((p, i) => (i === level ? found : p)));
      setLevels((prev) =>
        prev.map((lv, i) => (i === level ? { ...lv, glb: name, idleClip: guessIdle, actions: [] } : lv)),
      );
    } catch (err) {
      setError(`Failed to load ${name}: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const controller = controllerRef.current;
      if (!controller) return;
      const kind = ext(file.name);
      if (kind === 'glb' || kind === 'gltf') {
        const url = URL.createObjectURL(file);
        await loadGlbIntoLevel(editingLevel, url, file.name);
        URL.revokeObjectURL(url);
      } else if (kind === 'hdr' || kind === 'exr') {
        const url = URL.createObjectURL(file);
        try {
          await controller.loadHdr(url, file.name);
          setHdrName(file.name);
        } catch (err) {
          setError(`Failed to load HDR: ${(err as Error).message}`);
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        setError(`Unsupported file: .${kind} (drop a .glb / .gltf or .hdr)`);
      }
    },
    [editingLevel, loadGlbIntoLevel],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      Array.from(e.dataTransfer.files).forEach((f) => void loadFile(f));
    },
    [loadFile],
  );

  function updateLevel(patch: Partial<EnergyLevelConfig>) {
    setLevels((prev) => prev.map((lv, i) => (i === editingLevel ? { ...lv, ...patch } : lv)));
  }
  function toggleAction(clip: string) {
    const cur = lvl.actions;
    updateLevel({ actions: cur.includes(clip) ? cur.filter((c) => c !== clip) : [...cur, clip] });
  }
  function toggleTarget(name: string) {
    setPaletteTargets((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function updateBinding(i: number, patch: Partial<AudioBinding>) {
    setBindings((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }
  function addBinding() {
    setBindings((prev) => [
      ...prev,
      { source: 'bass', target: 'scale', amount: 0.3, smoothing: 0.5, enabled: true },
    ]);
  }
  function removeBinding(i: number) {
    setBindings((prev) => prev.filter((_, j) => j !== i));
  }

  function handleExport() {
    const controller = controllerRef.current;
    if (!controller) return;
    const config = controller.readConfig({
      paletteTargets,
      energyLevels: levels,
      audioBindings: bindings,
      transition: transitionMode,
      hdrName,
    });
    const json = JSON.stringify(config, null, 2);
    setExported(json);
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!exported) return;
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.config.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const lvl = levels[editingLevel]!;
  const insp = levelInspection[editingLevel];
  const anyGlb = levels.some((l) => l.glb);

  return (
    <div
      className="fixed inset-0 flex bg-black text-zinc-200"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Canvas */}
      <div className="relative flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: 'block' }} />

        {(dragging || !anyGlb) && (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-colors ${
              dragging ? 'bg-cyan-500/10' : ''
            }`}
          >
            <div
              className={`rounded-2xl border-2 border-dashed px-10 py-8 text-center font-mono text-sm ${
                dragging ? 'border-cyan-400 text-cyan-200' : 'border-zinc-700 text-zinc-500'
              }`}
            >
              <p className="mb-1 text-base">Drop a .glb onto level {editingLevel}</p>
              <p className="text-xs text-zinc-600">+ .hdr for environment · or use the test GLB →</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute left-4 top-4 rounded-full bg-zinc-900/80 px-3 py-1 font-mono text-xs text-cyan-300">
            loading…
          </div>
        )}
        {error && (
          <div className="absolute left-4 top-4 max-w-md rounded-lg bg-red-900/80 px-3 py-2 font-mono text-xs text-red-200">
            {error}
          </div>
        )}

        {anyGlb && (
          <div className="absolute bottom-4 left-4 rounded-full bg-zinc-900/80 px-3 py-1 font-mono text-xs text-zinc-300">
            energy {editingLevel} / {MAX_ENERGY}
            {micActive && <span className="ml-2 text-cyan-300">🎤 live</span>}
          </div>
        )}
      </div>

      {/* Control panel */}
      <aside className="flex w-[340px] flex-col gap-5 overflow-y-auto border-l border-zinc-800 bg-zinc-950/95 p-4 font-mono text-xs">
        <header>
          <h1 className="text-sm font-bold tracking-widest text-cyan-300">3D SANDBOX</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            One GLB per energy level. Author each level, then export the scene config.
          </p>
        </header>

        {/* Level selector */}
        <section className="space-y-2">
          <Label>Energy levels · editing {editingLevel}</Label>
          <div className="flex gap-1">
            {levels.map((lv, i) => (
              <button
                key={i}
                onClick={() => setEditingLevel(i)}
                className={`flex-1 rounded py-1.5 text-center ${
                  i === editingLevel
                    ? 'bg-cyan-500 font-bold text-black'
                    : lv.glb
                      ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                }`}
                title={lv.glb ?? 'no GLB'}
              >
                {i}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600">click a level to edit + preview it (eases there)</p>
        </section>

        {/* Per-level GLB */}
        <section className="space-y-2">
          <Label>Level {editingLevel} · model</Label>
          <Row k="GLB" v={lvl.glb ?? '—'} />
          <button
            onClick={() => void loadGlbIntoLevel(editingLevel, TEST_GLB_URL, 'goku.glb (test)')}
            className="w-full rounded border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
          >
            use test GLB (goku)
          </button>
          <p className="text-[10px] text-zinc-600">…or drag a .glb anywhere to assign it here</p>
        </section>

        {/* Per-level look + animations */}
        {insp && (
          <section className="space-y-3">
            <Label>Level {editingLevel} · look &amp; clips</Label>

            <div className="flex items-center gap-2">
              <span className="w-16 text-zinc-500">HSL bg</span>
              <input
                type="color"
                value={hslToHex(lvl.hsl)}
                onChange={(e) => updateLevel({ hsl: hexToHsl(e.target.value) })}
                className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
              <span className="text-[10px] text-zinc-600">background + global tint</span>
            </div>

            <label className="flex items-center gap-2">
              <span className="w-16 text-zinc-500">idle</span>
              <select
                value={lvl.idleClip ?? ''}
                onChange={(e) => updateLevel({ idleClip: e.target.value || null })}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
              >
                <option value="">— none —</option>
                {insp.clips.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="mb-1 text-[11px] text-zinc-500">Actions — tick to enable, ▶ to test</p>
              {insp.clips.length === 0 && <Empty>no clips in this GLB</Empty>}
              {insp.clips.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={lvl.actions.includes(c)}
                    onChange={() => toggleAction(c)}
                    className="accent-cyan-400"
                  />
                  <span className="flex-1 truncate">{c}</span>
                  <button
                    onClick={() => controllerRef.current?.playAction(editingLevel, c)}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-cyan-300 hover:bg-zinc-700"
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-1 text-[11px] text-zinc-500">Palette-tinted materials</p>
              {insp.materials.map((name) => {
                const idx = paletteTargets.indexOf(name);
                return (
                  <label key={name} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={idx !== -1}
                      onChange={() => toggleTarget(name)}
                      className="accent-cyan-400"
                    />
                    <span className="truncate">{name}</span>
                    {idx !== -1 && (
                      <span
                        className="ml-auto h-3 w-3 flex-none rounded-sm"
                        style={{ background: palette[idx % palette.length] }}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <p className="text-[10px] text-zinc-600">
              {insp.meshes.length} meshes · {insp.materials.length} materials · {insp.clips.length} clips
            </p>
          </section>
        )}

        {/* Palette */}
        <section className="space-y-2">
          <Label>Palette</Label>
          <div className="flex gap-2">
            {palette.map((c, i) => (
              <input
                key={i}
                type="color"
                value={c}
                onChange={(e) => setPalette((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                className="h-8 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
            ))}
          </div>
        </section>

        {/* Global scene + audio */}
        <section className="space-y-3">
          <Label>Scene</Label>
          <div className="flex items-center gap-2">
            <span className="w-20 text-zinc-500">transition</span>
            <div className="flex flex-1 gap-1">
              {(['crossfade', 'cut'] as TransitionMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setTransitionMode(m)}
                  className={`flex-1 rounded py-1 ${
                    transitionMode === m ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label={`exposure ${exposure.toFixed(2)}`}
            min={0.1}
            max={3}
            step={0.05}
            value={exposure}
            onChange={setExposure}
          />
          <Row k="HDR" v={hdrName ?? '—'} />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useHdrBg}
              disabled={!hdrName}
              onChange={(e) => setUseHdrBg(e.target.checked)}
              className="accent-cyan-400"
            />
            <span className={hdrName ? '' : 'text-zinc-600'}>use HDR as background</span>
          </label>
          <button
            onClick={() => setMicOn((v) => !v)}
            className={`w-full rounded px-3 py-1.5 ${
              micActive
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {micActive ? '🎤 mic on — reacting to audio' : '🎤 use laptop mic'}
          </button>
          {micError && <p className="text-[11px] text-red-400">{micError}</p>}
        </section>

        {/* Audio reactivity */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Audio reactivity</Label>
            <button onClick={addBinding} className="text-cyan-300 hover:text-cyan-200">
              + add
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-600">
            source → target. <span className="text-zinc-400">amount</span> = how strong,{' '}
            <span className="text-zinc-400">filter</span> = tames spikes.
          </p>
          {bindings.length === 0 && <Empty>no connections</Empty>}
          {bindings.map((b, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) => updateBinding(i, { enabled: e.target.checked })}
                  className="accent-cyan-400"
                />
                <select
                  value={b.source}
                  onChange={(e) => updateBinding(i, { source: e.target.value as AudioSource })}
                  className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                >
                  {AUDIO_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="text-zinc-600">→</span>
                <select
                  value={b.target}
                  onChange={(e) => updateBinding(i, { target: e.target.value as AudioTarget })}
                  className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                >
                  {AUDIO_TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeBinding(i)}
                  className="px-1 text-zinc-500 hover:text-red-400"
                  title="remove"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Slider
                  label={`amount ${b.amount.toFixed(2)}`}
                  min={0}
                  max={3}
                  step={0.05}
                  value={b.amount}
                  onChange={(v) => updateBinding(i, { amount: v })}
                />
                <Slider
                  label={`filter ${b.smoothing.toFixed(2)}`}
                  min={0}
                  max={0.95}
                  step={0.05}
                  value={b.smoothing}
                  onChange={(v) => updateBinding(i, { smoothing: v })}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Export */}
        <section className="mt-auto space-y-2 border-t border-zinc-800 pt-4">
          <button
            onClick={handleExport}
            disabled={!anyGlb}
            className="w-full rounded bg-cyan-500 px-3 py-2 font-bold text-black hover:bg-cyan-400 disabled:opacity-40"
          >
            {copied ? '✓ copied to clipboard' : 'Export config'}
          </button>
          {exported && (
            <>
              <textarea
                readOnly
                value={exported}
                className="h-40 w-full resize-none rounded border border-zinc-800 bg-zinc-900 p-2 text-[10px] leading-snug text-zinc-300"
              />
              <button
                onClick={handleDownload}
                className="w-full rounded border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
              >
                Download .config.json
              </button>
            </>
          )}
        </section>
      </aside>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{children}</h2>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-zinc-600">{k}</span>
      <span className="truncate text-zinc-300">{v}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] italic text-zinc-600">{children}</p>;
}
function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-zinc-400">
        <span>{label}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}
