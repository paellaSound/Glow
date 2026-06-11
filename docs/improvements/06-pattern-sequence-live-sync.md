# 06 — Pattern Sequence Live Sync & Preview Parity

## Summary

Two issues in the control-desk Pattern Sequence editor
(`web/components/glow/pattern-sequence-editor.tsx`, `variant="control"`), found during the
demo:

1. **Live edits to palette / effects don't reach player devices** until a media-overlay
   toggle (or save/load) is triggered. Toggling media shows instantly; palette color
   changes and adding/removing/enabling/disabling effects do **not** — until you toggle
   media again, which then flushes everything.
2. **Preview ≠ device:** what the sequence editor preview shows does not match what the
   player device actually renders.

---

## Root cause (confirmed)

### Bug 1 — Only media edits push live

In the editor, local edits go through `patchDraft` / `patchEffects`, which update state and
the **preview only** — they never call `onSendLive` (which emits
`orchestrator:run_distribution`):

```166:176:web/components/glow/pattern-sequence-editor.tsx
  function patchDraft(patch: Partial<PatternSequenceDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      onPreviewChange?.(next);
      return next;
    });
  }

  function patchEffects(nextEffects: PatternSequenceEffect[]) {
    patchDraft({ effects: nextEffects });
  }
```

`onSendLive(draft)` is only called on: `loadSequence` (sequence select), `saveSequence`
(save/overwrite), the auto-select effect — and on **every media change**, which sends the
full draft:

```800:802:web/components/glow/pattern-sequence-editor.tsx
                        patchDraft({ media: updatedMedia });
                        if (isControlVariant) {
                          onSendLive({ ...draft, media: updatedMedia });
```

So palette (`onChange={(palette) => patchDraft({ palette })}`) and effect mutations
(`patchEffects`, `toggleEffectActive`, `addEffect`, `removeEffect`, weight sliders) never
emit live. Toggling media sends the whole draft → that's why media "flushes" the pending
palette/effect changes.

### Bug 2 — Preview vs device parity

The editor preview (`web/components/glow/pattern-sequence-preview.tsx`) renders through a
different path than the player device (`web/lib/glow/visual-engine.ts` +
`glow-presets`). Differences observed: palette/param mapping and what's shown (the preview
shows the **preview/split** effect locally, while a device renders the **one** effect it
was assigned by the weighted distribution). Result: the operator can't trust the preview.

---

## Fix / implementation phases

### Phase 1 — Live propagation of palette/effect edits (control variant)

- [ ] In `variant="control"`, palette and effect edits must push live, like media does.
      Either call `onSendLive` from `patchDraft`/`patchEffects` when in control variant, or
      add an effect that watches the draft and emits `orchestrator:run_distribution`.
- [ ] **Debounce** continuous inputs (palette color picker, weight sliders) ~150–250 ms to
      avoid spamming `run_distribution`; discrete toggles (active on/off, add/remove) can
      send immediately.
- [ ] Keep `onPreviewChange` for the local preview (unchanged).
- [ ] Verify no double-send when media + palette change together.

### Phase 2 — Preview/device parity

- [ ] Make the preview render through the **same** code path as the device
      (`visual-engine` / `glow-presets` compositor) with the same palette and param mapping.
- [ ] Clarify semantics: a device shows its **distributed slice** (one effect), while the
      preview can show split/all. Make the preview's "what a device sees" mode match a single
      device's assignment so the operator sees true device output. Keep the "split preview"
      as an explicit separate mode/badge.
- [ ] Confirm audio-reactive presets use comparable input in preview vs device (simulated
      vs real mic) so colors/motion look equivalent.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/components/glow/pattern-sequence-editor.tsx` | Live-send palette/effect edits (debounced) in control variant |
| `web/app/(control)/room/[code]/control/page.tsx` | `sendDistribution` wiring (already present) — ensure debounced path |
| `web/components/glow/pattern-sequence-preview.tsx` | Render via the device path for parity |
| `web/lib/glow/visual-engine.ts` | Shared render path reused by the preview (if refactor needed) |

---

## Acceptance criteria

- Changing a palette color or adding/removing/enabling/disabling an effect updates the
  player devices **live**, without needing to toggle media or save.
- Continuous inputs are debounced (no flood of `run_distribution`).
- Media toggles still work instantly (unchanged).
- The editor preview matches what a player device renders for the same sequence (palette,
  effect, motion), with split/all preview as an explicit separate mode.
- Typecheck clean in `web` and `realtime`.
