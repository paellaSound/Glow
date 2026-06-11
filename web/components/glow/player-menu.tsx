'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  MoreHorizontal,
  X,
  LogOut,
  Share2,
  QrCode,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoomQrPanel } from '@/components/glow/room-qr-panel';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import type { RigSocial } from '@/lib/glow/social-kinds';
import type { TorchCapability } from '@/lib/glow/types';

interface PlayerMenuProps {
  roomCode: string;
  nickname: string;
  displayLabel?: string;
  onExit: () => void;
  torchCapability?: TorchCapability;
  torchActive?: boolean;
  torchEnabling?: boolean;
  torchError?: string | null;
  onEnableTorch?: () => void;
  onDisableTorch?: () => void;
}

type ShareInfo = {
  rigName: string | null;
  socials: RigSocial[];
};

export function PlayerMenu({
  roomCode,
  nickname,
  displayLabel,
  onExit,
  torchCapability,
  torchActive = false,
  torchEnabling = false,
  torchError = null,
  onEnableTorch,
  onDisableTorch,
}: PlayerMenuProps) {
  // Collapsed defaults to false so it is open when mounted first
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo>({ rigName: null, socials: [] });

  const joinUrl = useMemo(
    () => buildPlayerJoinUrl(roomCode, { matrix: false }),
    [roomCode]
  );

  // Monitor fullscreen state changes
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent || ''));

    const isSupported = !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
    setIsFullscreenSupported(isSupported);

    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      setIsFullscreen(!!fsElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initialize state
    const doc = document as any;
    const fsElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
    setIsFullscreen(!!fsElement);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isQrModalOpen) return;

    void fetch(`/api/rooms/${roomCode.toUpperCase()}/share-info`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ShareInfo | null) => {
        if (data) setShareInfo(data);
      })
      .catch(() => {
        setShareInfo({ rigName: null, socials: [] });
      });
  }, [isQrModalOpen, roomCode]);

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function toggleFullscreen() {
    try {
      const doc = document as any;
      const el = document.documentElement as any;
      const fsElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

      if (fsElement) {
        const exitFs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exitFs) {
          await exitFs.call(doc);
        }
      } else {
        const reqFs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (reqFs) {
          await reqFs.call(el);
        }
      }
    } catch {
      // Best effort
    }
  }

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setShowConfirmExit(false);
  };

  return (
    <div className="dark fixed top-4 right-4 z-40 flex flex-col items-end gap-2 select-none">
      {/* Horizontal Toolbar with a cyber neon glow style */}
      <div className="flex items-center gap-1.5 rounded-full bg-black/75 border border-neon-cyan/40 p-1 backdrop-blur-md transition-all duration-300 shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:shadow-[0_0_20px_rgba(0,229,255,0.45)]">
        {!isCollapsed && (
          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Share button */}
            <button
              type="button"
              onClick={() => void copyJoinLink()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title={copied ? 'Copied!' : 'Copy Link'}
            >
              {copied ? (
                <ClipboardCheck className="h-4 w-4 text-neon-cyan" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </button>

            {/* QR button */}
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="View QR Code"
            >
              <QrCode className="h-4 w-4" />
            </button>

            {/* Fullscreen toggle button */}
            {isFullscreenSupported && (
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}

            {/* More (⋯) trigger button */}
            <button
              type="button"
              onClick={() => setIsSheetOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="More Options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Collapse/Expand Toggle button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title={isCollapsed ? 'Expand Menu' : 'Collapse'}
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* QR Modal */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-white/10 p-1.5 text-zinc-400 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <RoomQrPanel
              roomCode={roomCode}
              matrixEnabled={false}
              rigName={shareInfo.rigName}
              socials={shareInfo.socials}
              qrSize={320}
              variant="dark"
              showJoinUrl={false}
            />
          </div>
        </div>
      )}

      {/* More Options Sheet */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={handleCloseSheet}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border-t border-x border-white/10 bg-zinc-950 p-6 text-white shadow-2xl transition-transform duration-300 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <h3 className="font-cyber text-sm font-bold uppercase tracking-widest text-neon-cyan">
                  RAVER HUD
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {nickname} {displayLabel ? `(${displayLabel})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSheet}
                className="rounded-full border border-white/10 p-1.5 text-zinc-400 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>



            {/* Flash effects opt-in */}
            {onEnableTorch && onDisableTorch ? (
              <div className="mb-5 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-cyber uppercase tracking-widest text-neon-cyan">
                      Flash Effects
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      Enable camera access to blink your phone LED during rave effects.
                      You can disable this anytime.
                    </p>
                    {isIOS && (
                      <p className="mt-1.5 text-[10px] text-amber-300/80 italic leading-relaxed">
                        Note: iOS Safari does not support hardware LED controls. Screen-flash fallback will be used.
                      </p>
                    )}
                    {torchCapability?.enabled ? (
                      <p className="mt-2 text-[10px] font-cyber uppercase tracking-wider text-emerald-400">
                        {torchCapability.supported
                          ? torchActive
                            ? 'LED flash active'
                            : 'LED flash ready'
                          : 'Screen flash fallback active'}
                      </p>
                    ) : null}
                    {torchError ? (
                      <p className="mt-2 text-[10px] text-amber-300">{torchError}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  {torchCapability?.enabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-white/10 text-xs font-cyber uppercase tracking-widest h-9 cursor-pointer"
                      onClick={() => void onDisableTorch()}
                    >
                      Disable flash effects
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="w-full bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/30 text-xs font-cyber uppercase tracking-widest h-9 cursor-pointer"
                      disabled={torchEnabling}
                      onClick={() => void onEnableTorch()}
                    >
                      {torchEnabling ? 'Enabling...' : 'Enable flash effects'}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Actions */}
            <div className="space-y-4">
              {!showConfirmExit ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full font-cyber text-xs uppercase tracking-widest h-11 cursor-pointer"
                  onClick={() => setShowConfirmExit(true)}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Exit Rave
                </Button>
              ) : (
                <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 text-center">
                  <p className="text-xs text-zinc-200 mb-3 font-medium">
                    Are you sure you want to leave the rave?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 font-cyber text-[10px] uppercase tracking-wider h-9 cursor-pointer"
                      onClick={onExit}
                    >
                      Yes, Leave
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-white/10 hover:bg-white/5 text-white font-cyber text-[10px] uppercase tracking-wider h-9 cursor-pointer"
                      onClick={() => setShowConfirmExit(false)}
                    >
                      Keep Dancing
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
