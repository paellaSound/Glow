'use client';

import { useState, useRef } from 'react';
import { DeviceTargetSlider } from './device-target-slider';
import { GifSearch } from './gif-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NeonButton, NeonTitle } from '@/components/ui/neon';
import { cn } from '@/lib/utils';
import { PlanGate } from '@/components/glow/plan-gate';
import type { DeviceTarget, RoomStatePayload } from '@/lib/glow/types';

type MediaPanelProps = {
  roomCode: string;
  roomState: RoomStatePayload;
  socket: any; // SocketRef
  disabled?: boolean;
};

type ActiveSubTab = 'image' | 'text' | 'gif';

export function MediaPanel({ roomCode, roomState, socket, disabled = false }: MediaPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<ActiveSubTab>('image');
  const [target, setTarget] = useState<DeviceTarget>({ kind: 'all' });
  // Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>('cover');
  const [durationSec, setDurationSec] = useState<string>('');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text states
  const [text, setText] = useState('');
  const [textMode, setTextMode] = useState<'marquee' | 'word_by_word' | 'spread_grid'>('marquee');
  const [textSpeed, setTextSpeed] = useState<number>(5);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textLoop, setTextLoop] = useState(true);

  // GIF states
  const [selectedGif, setSelectedGif] = useState<{ slug: string; url: string; width: number; height: number } | null>(null);

  // General state
  const [sending, setSending] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);

    if (file.size > 1048576) {
      setImageError('File size must be 1 MB or less.');
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setImageError('Only PNG, JPEG, WEBP, and GIF images are supported.');
      return;
    }

    setImageFile(file);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/rooms/${roomCode}/media`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const data = await res.json();
      setImageUrl(data.url);
    } catch (err: any) {
      setImageError(err.message || 'Failed to upload image.');
      setImageFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (disabled || sending) return;
    setSending(true);

    try {
      if (activeSubTab === 'image') {
        if (!imageUrl) {
          alert('Please upload an image first');
          setSending(false);
          return;
        }
        const durationMs = durationSec.trim() ? parseInt(durationSec) * 1000 : undefined;
        socket.current?.emit('orchestrator:media_image', {
          roomCode,
          url: imageUrl,
          target,
          fit: imageFit,
          durationMs,
        });
      } else if (activeSubTab === 'text') {
        if (!text.trim()) {
          alert('Please enter some text to broadcast');
          setSending(false);
          return;
        }
        socket.current?.emit('orchestrator:media_text', {
          roomCode,
          text: text.trim(),
          mode: textMode,
          speed: textSpeed,
          colorHex: textColor.trim() || undefined,
          loop: textLoop,
          target,
        });
      } else if (activeSubTab === 'gif') {
        if (!selectedGif) {
          alert('Please select a GIF from the search results');
          setSending(false);
          return;
        }
        socket.current?.emit('orchestrator:media_gif', {
          roomCode,
          slug: selectedGif.slug,
          url: selectedGif.url,
          width: selectedGif.width,
          height: selectedGif.height,
          target,
        });

        void fetch('/api/klipy/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: selectedGif.slug }),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    socket.current?.emit('orchestrator:media_clear', {
      roomCode,
      target,
    });
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <NeonTitle as="h2" color="magenta" className="text-lg font-black tracking-widest">
            Media Broadcaster
          </NeonTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Broadcast custom files, scrolling text, or reaction GIFs onto active device matrices.
          </p>
        </div>

        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
          {(['image', 'text', 'gif'] as const).map((subTab) => (
            <button
              key={subTab}
              type="button"
              onClick={() => setActiveSubTab(subTab)}
              className={cn(
                'rounded-lg px-4 py-2 text-xs font-cyber uppercase tracking-widest transition-all',
                activeSubTab === subTab
                  ? 'bg-neon-magenta/15 text-neon-magenta border border-neon-magenta/30'
                  : 'text-zinc-500 hover:text-zinc-200'
              )}
            >
              {subTab === 'image' ? 'Image' : subTab === 'text' ? 'Text' : 'GIF'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="relative min-h-[340px] rounded-xl border border-white/10 bg-black/20 p-5 md:col-span-3">
          {activeSubTab === 'image' && (
            <PlanGate feature="customMediaUpload" roomEntitlements={roomState.entitlements}>
            <div className="flex flex-col gap-4 h-full">
              <div className="space-y-2">
                <Label className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300">
                  Custom Image (Mime: PNG/JPG/WEBP/GIF, Size ≤ 1 MB)
                </Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-black/40 h-32 hover:border-white/20 transition-all cursor-pointer p-4 text-center"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />
                  {uploading ? (
                    <span className="text-xs font-cyber text-zinc-400 animate-pulse">Uploading file...</span>
                  ) : imageUrl ? (
                    <div className="flex items-center gap-3 w-full h-full justify-center">
                      <img src={imageUrl} alt="Uploaded preview" className="h-full max-w-[80px] object-contain rounded border border-white/10" />
                      <div className="text-left">
                        <p className="text-xs text-white truncate max-w-[120px]">{imageFile?.name}</p>
                        <p className="text-[9px] text-zinc-500 font-cyber">{(imageFile!.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-xl">🖼</span>
                      <span className="text-xs font-cyber text-zinc-400 mt-2 uppercase tracking-wide">
                        Click to select image file
                      </span>
                    </>
                  )}
                </div>
                {imageError && (
                  <p className="text-[10px] text-red-500 font-cyber tracking-wide uppercase mt-1">
                    {imageError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300">
                    Image Fit Layout
                  </Label>
                  <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                    {(['cover', 'contain'] as const).map((fit) => (
                      <button
                        key={fit}
                        type="button"
                        onClick={() => setImageFit(fit)}
                        className={cn(
                          'flex-1 rounded-md py-1.5 text-[10px] font-cyber uppercase tracking-widest text-center transition-all',
                          imageFit === fit ? 'bg-neon-magenta/20 text-neon-magenta' : 'text-zinc-500 hover:text-zinc-300'
                        )}
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration" className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300">
                    Duration (Seconds, Optional)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    placeholder="Infinite"
                    value={durationSec}
                    onChange={(e) => setDurationSec(e.target.value)}
                    className="font-cyber h-9 text-xs text-white border-white/10"
                  />
                </div>
              </div>
            </div>
            </PlanGate>
          )}

          {activeSubTab === 'text' && (
            <PlanGate feature="sequencedText" roomEntitlements={roomState.entitlements}>
            <div className="flex flex-col gap-4 h-full">
              <div className="space-y-2">
                <Label htmlFor="message" className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300">
                  Broadcast Text
                </Label>
                <Textarea
                  id="message"
                  placeholder="TYPE MESSAGE TO SEQUENCE ACROSS SCREENS..."
                  value={text}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                  className="font-cyber text-xs uppercase h-20 bg-black/40 border-white/10 resize-none text-white"
                  maxLength={160}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['marquee', 'word_by_word', 'spread_grid'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setTextMode(mode);
                      setTextSpeed(mode === 'word_by_word' ? 3 : mode === 'marquee' ? 12 : 4);
                    }}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-[9px] font-cyber uppercase tracking-wider text-center transition-all',
                      textMode === mode
                        ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta shadow-[0_0_8px_rgba(255,0,229,0.15)]'
                        : 'border-white/5 bg-black/20 text-zinc-400 hover:border-white/10'
                    )}
                  >
                    {mode === 'marquee' ? 'Marquee' : mode === 'word_by_word' ? 'Word' : 'Grid'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="speed" className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300">
                    Speed ({textMode === 'word_by_word' ? 'Words' : textMode === 'marquee' ? 'Chars' : 'Pages'}/Sec)
                  </Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTextSpeed(Math.max(1, textSpeed - 1))}
                      className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                    >
                      -
                    </button>
                    <input
                      id="speed"
                      type="range"
                      min="1"
                      max="30"
                      value={textSpeed}
                      onChange={(e) => setTextSpeed(parseInt(e.target.value))}
                      className="flex-1 accent-neon-magenta cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setTextSpeed(Math.min(30, textSpeed + 1))}
                      className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                    >
                      +
                    </button>
                    <span className="font-cyber text-xs text-white min-w-[20px]">{textSpeed}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textColor" className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300">
                    Text Color (Hex)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="textColor"
                      type="text"
                      placeholder="#FFFFFF"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="font-cyber h-9 text-xs text-white border-white/10"
                      maxLength={7}
                    />
                    <input
                      type="color"
                      value={textColor.startsWith('#') ? textColor : '#ffffff'}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="size-9 p-0 rounded-lg bg-transparent border border-white/10 overflow-hidden cursor-pointer shrink-0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  id="loop"
                  type="checkbox"
                  checked={textLoop}
                  onChange={(e) => setTextLoop(e.target.checked)}
                  className="accent-neon-magenta size-4 rounded"
                />
                <Label htmlFor="loop" className="font-cyber text-[10px] uppercase tracking-wider text-zinc-300 select-none cursor-pointer">
                  Loop continuously
                </Label>
              </div>
            </div>
            </PlanGate>
          )}

          {activeSubTab === 'gif' && (
            <PlanGate feature="gifBroadcast" roomEntitlements={roomState.entitlements}>
            <div className="flex flex-col gap-4 h-full">
              <GifSearch
                onSelect={(gif) => setSelectedGif(gif)}
                selectedSlug={selectedGif?.slug}
                gifSearchMode={roomState.entitlements.gifSearchMode}
              />
            </div>
            </PlanGate>
          )}
        </div>

        <div className="flex flex-col gap-5 md:col-span-2 justify-between">
          <DeviceTargetSlider
            devices={roomState.devices}
            value={target}
            onChange={setTarget}
          />

          <div className="flex flex-col gap-3">
            <NeonButton
              color="magenta"
              variant="solid"
              disabled={disabled || sending}
              onClick={handleSend}
              className="w-full text-xs uppercase tracking-widest h-11"
            >
              {sending ? 'Sending...' : 'Broadcast Media'}
            </NeonButton>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={handleClear}
              className="w-full text-xs font-cyber uppercase tracking-widest h-10 text-zinc-300 border-white/10 hover:bg-white/5 bg-transparent"
            >
              Clear Media
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
