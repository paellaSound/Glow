'use client';

import { useEffect, useState } from 'react';
import type { SandboxController } from 'glow-visuals-3d';

export type ControllerRef = React.MutableRefObject<SandboxController | null>;

export function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{children}</h2>;
}

export function SectionTip({ children, title = 'Tip' }: { children: React.ReactNode; title?: string }) {
  return (
    <p className="text-[10px] leading-relaxed text-zinc-600">
      <span className="text-zinc-500" title={title}>
        ?
      </span>{' '}
      {children}
    </p>
  );
}

export function Tooltip({
  label,
  tip,
  children,
}: {
  label: string;
  tip: string;
  children: React.ReactNode;
}) {
  return (
    <div title={`${label}: ${tip}`} className="contents">
      {children}
    </div>
  );
}

export function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-zinc-600">{k}</span>
      <span className="truncate text-zinc-300">{v}</span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] italic text-zinc-600">{children}</p>;
}

export function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  tip,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  tip?: string;
}) {
  return (
    <div title={tip}>
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
        title={tip}
      />
    </div>
  );
}

export function AudioBands({ controllerRef }: { controllerRef: ControllerRef }) {
  const [lvls, setLvls] = useState({ bass: 0, mid: 0, treble: 0, energy: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = controllerRef.current?.getAudioDebug();
      if (d) setLvls(d.feats);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controllerRef]);
  const bands: [string, number, string][] = [
    ['bass', lvls.bass, '#00e3ff'],
    ['mid', lvls.mid, '#7c4dff'],
    ['treble', lvls.treble, '#ff00c8'],
    ['energy', lvls.energy, '#ffb300'],
  ];
  return (
    <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
      {bands.map(([name, v, c]) => (
        <div key={name} className="flex items-center gap-2" title={`Live ${name} band (0–1)`}>
          <span className="w-12 text-zinc-500">{name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full rounded transition-[width] duration-75"
              style={{ width: `${Math.min(100, v * 100)}%`, background: c }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BindingMeter({
  controllerRef,
  index,
  amount,
}: {
  controllerRef: ControllerRef;
  index: number;
  amount: number;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = controllerRef.current?.getAudioDebug();
      if (d) setV(Math.min(1, ((d.bindings[index] ?? 0) * amount) / 3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controllerRef, index, amount]);
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-800" title="Binding output (smoothed × amount)">
      <div className="h-full rounded bg-cyan-400" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function AvgEnergyMeter({ controllerRef }: { controllerRef: ControllerRef }) {
  const [d, setD] = useState({ avg: 0, level: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const dbg = controllerRef.current?.getAudioDebug();
      if (dbg) setD({ avg: dbg.avgEnergy, level: dbg.autoLevel });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controllerRef]);
  return (
    <div className="flex items-center gap-2" title="Normalized average energy → auto level">
      <span className="w-12 text-zinc-500">avg</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
        <div className="h-full rounded bg-cyan-400" style={{ width: `${Math.min(100, d.avg * 100)}%` }} />
      </div>
      <span className="w-10 text-right text-cyan-300">lvl {d.level}</span>
    </div>
  );
}

export function TriggerFlash({ controllerRef, index }: { controllerRef: ControllerRef; index: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = controllerRef.current?.getAudioDebug();
      if (d) setOn(!!d.triggersFired[index]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controllerRef, index]);
  return (
    <span
      className={`h-2.5 w-2.5 flex-none rounded-full ${on ? 'bg-cyan-400' : 'bg-zinc-700'}`}
      title="Trigger fired"
    />
  );
}
