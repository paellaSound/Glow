'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  EMOJI_GLYPHS,
  REACTION_ALLOWLIST_FREE,
  REACTION_ALLOWLIST_PAID,
  ReactionEmoji,
} from 'glow-visuals';
import type { RoomStatePayload } from '@/lib/glow/types';

interface ReactionsToolbarProps {
  roomCode: string;
  roomState: RoomStatePayload | null;
  onEmit: (event: string, payload: { roomCode: string; emoji: ReactionEmoji }) => void;
}

export function ReactionsToolbar({ roomCode, roomState, onEmit }: ReactionsToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  if (roomState?.entitlements?.audienceReactions === false) {
    return null;
  }

  const maxDevices = roomState?.entitlements?.maxDevices ?? 10;
  const advancedMatrix = roomState?.entitlements?.advancedMatrix ?? false;
  const isFree = maxDevices <= 10 && !advancedMatrix;
  const allowedEmojis = isFree ? REACTION_ALLOWLIST_FREE : REACTION_ALLOWLIST_PAID;

  const handleTap = (emoji: ReactionEmoji) => {
    onEmit('player:reaction', { roomCode, emoji });
    setClickCounts((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
  };

  return (
    <div className="dark fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center select-none">
      <div className="flex items-center gap-1.5 rounded-full bg-black/75 border border-neon-cyan/40 p-1 backdrop-blur-md transition-all duration-300 shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:shadow-[0_0_20px_rgba(0,229,255,0.45)]">
        {!isCollapsed && (
          <div className="flex items-center gap-1.5 px-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {allowedEmojis.map((emoji) => {
              const count = clickCounts[emoji] || 0;
              const glyph = EMOJI_GLYPHS[emoji];
              return (
                <button
                  key={`${emoji}-${count}`}
                  type="button"
                  onClick={() => handleTap(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl cursor-pointer select-none transition-all active:scale-90 hover:bg-white/10 hover:shadow-[0_0_8px_rgba(0,229,255,0.2)] animate-[emoji-toolbar-pulse_0.15s_ease-out]"
                >
                  {glyph}
                </button>
              );
            })}
          </div>
        )}

        {/* Collapse/Expand Toggle button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer ${
            !isCollapsed ? 'border-l border-white/10 ml-1 pl-1' : ''
          }`}
          title={isCollapsed ? 'Show Reactions' : 'Hide'}
        >
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      <style>{`
        @keyframes emoji-toolbar-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
