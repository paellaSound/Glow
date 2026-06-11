'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Layers, Plus, Trash2 } from 'lucide-react';
import {
  NeonButton,
  NeonCard,
  NeonTitle,
  PageTransitionWrapper,
  SectionGlow,
} from '@/components/ui/neon';
import { PatternSequenceEditor } from '@/components/glow/pattern-sequence-editor';
import {
  createDefaultDraft,
  fetchPatternSequences,
  type PatternSequenceDraft,
  type PatternSequenceRecord,
} from '@/lib/glow/pattern-sequences';
import { DEFAULT_ENTITLEMENTS } from '@/lib/entitlements-defaults';

const teamFetcher = (url: string) => fetch(url).then((res) => res.json());

type UserApiResponse = {
  entitlements?: typeof DEFAULT_ENTITLEMENTS;
};

export default function PatternSequencesPage() {
  const { data: userData } = useSWR<UserApiResponse>('/api/team', teamFetcher);
  const { data: sequences = [], mutate } = useSWR<PatternSequenceRecord[]>(
    '/api/pattern-sequences',
    fetchPatternSequences
  );

  const entitlements = userData?.entitlements ?? DEFAULT_ENTITLEMENTS;
  const [draft, setDraft] = useState<PatternSequenceDraft>(createDefaultDraft());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function deleteSequence(id: string) {
    const response = await fetch(`/api/pattern-sequences/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    if (selectedId === id) {
      setSelectedId(null);
      setDraft(createDefaultDraft());
    }
    await mutate();
  }

  return (
    <main className="relative mx-auto max-w-5xl px-4 py-8 min-h-screen overflow-hidden sm:px-6">
      <SectionGlow glowColor="violet" position="top" />

      <PageTransitionWrapper>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <NeonTitle as="h1" color="violet" className="text-3xl font-black tracking-widest">
              Pattern Sequences
            </NeonTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Save reusable Rave Pattern Sequences and load them in any live room.
            </p>
          </div>
          <Link
            href="/room/new"
            className="inline-flex h-10 items-center rounded-full border border-neon-violet/30 px-4 text-xs font-cyber uppercase tracking-widest text-neon-violet"
          >
            Create room
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <NeonTitle as="h2" color="white" className="text-sm font-black tracking-widest">
                Library
              </NeonTitle>
              <span className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                {sequences?.length ?? 0} / {entitlements.maxPatternSequences}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:border-neon-violet/30"
                onClick={() => {
                  setSelectedId(null);
                  setDraft(createDefaultDraft());
                }}
              >
                <Plus className="size-4" />
                New sequence
              </button>

              {sequences?.map((sequence) => (
                <div
                  key={sequence.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelectedId(sequence.id);
                      setDraft({
                        name: sequence.name,
                        palette: sequence.palette,
                        effects: sequence.effects,
                        isDefault: sequence.isDefault,
                      });
                    }}
                  >
                    <span className="block truncate text-sm font-medium">{sequence.name}</span>
                    <span className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                      {sequence.effects.filter((effect) => effect.active).length} effects
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${sequence.name}`}
                    className="rounded-md border border-white/10 p-2 text-red-400 hover:border-red-400/30"
                    onClick={() => void deleteSequence(sequence.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </NeonCard>

          <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="size-4 text-neon-violet" />
              <NeonTitle as="h2" color="violet" className="text-lg font-black tracking-widest">
                {selectedId ? 'Edit sequence' : 'New sequence'}
              </NeonTitle>
            </div>

            <PatternSequenceEditor
              key={selectedId ?? 'new'}
              availablePresetIds={entitlements.availablePresets}
              audioReactive={entitlements.audioReactive}
              effectLayering={entitlements.effectLayering}
              maxPatternSequences={entitlements.maxPatternSequences}
              audioSource="local"
              onAudioSourceChange={() => {}}
              initialDraft={draft}
              onPreviewChange={setDraft}
              onSendLive={() => {}}
            />
          </NeonCard>
        </div>
      </PageTransitionWrapper>
    </main>
  );
}
