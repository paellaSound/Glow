'use client';

import React, { useState } from 'react';
import {
  EMOJI_GLYPHS,
  REACTION_ALLOWLIST_FREE,
  REACTION_ALLOWLIST_PAID,
  ReactionEmoji,
} from 'glow-visuals';

interface ReactionsBarProps {
  roomCode: string;
  maxDevices?: number;
  advancedMatrix?: boolean;
  onEmit: (event: string, payload: { roomCode: string; emoji: ReactionEmoji }) => void;
}

export function ReactionsBar({ roomCode, maxDevices = 10, advancedMatrix = false, onEmit }: ReactionsBarProps) {
  // Free tier has maxDevices === 10 and no advancedMatrix
  const isFree = maxDevices <= 10 && !advancedMatrix;
  const allowedEmojis = isFree ? REACTION_ALLOWLIST_FREE : REACTION_ALLOWLIST_PAID;

  // Track click times to reset key and trigger CSS pulse animation on every rapid tap
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  const handleTap = (emoji: ReactionEmoji) => {
    onEmit('player:reaction', { roomCode, emoji });
    
    setClickCounts((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
  };

  return (
    <div className="w-full py-2 px-1">
      <div className="flex flex-wrap gap-2.5 justify-center items-center">
        {allowedEmojis.map((emoji) => {
          const count = clickCounts[emoji] || 0;
          const glyph = EMOJI_GLYPHS[emoji];
          return (
            <button
              key={`${emoji}-${count}`}
              type="button"
              onClick={() => handleTap(emoji)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-white/10 text-2xl cursor-pointer select-none transition-all active:scale-95 hover:bg-zinc-800 hover:border-neon-cyan/40 hover:shadow-[0_0_10px_rgba(0,229,255,0.2)] animate-[emoji-pulse_0.15s_ease-out]"
              style={{ contentVisibility: 'auto' }}
            >
              {glyph}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes emoji-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); border-color: rgba(0, 229, 255, 0.6); box-shadow: 0 0 15px rgba(0, 229, 255, 0.4); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
