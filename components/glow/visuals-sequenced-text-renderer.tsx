'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface VisualsSequencedTextRendererProps {
  text: string;
  mode: 'marquee' | 'word_by_word' | 'spread_grid';
  speed: number;
  colorHex?: string;
  loop: boolean;
  matrix: { rows: number; cols: number };
  fontSize?: number;
}

export function VisualsSequencedTextRenderer({
  text,
  mode,
  speed,
  colorHex = '#ffffff',
  loop,
  matrix,
  fontSize,
}: VisualsSequencedTextRendererProps) {
  const [wordIdx, setWordIdx] = useState(0);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    if (mode !== 'word_by_word' || words.length === 0) return;
    setWordIdx(0);
    const interval = setInterval(() => {
      setWordIdx((prev) => {
        if (prev + 1 >= words.length) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / Math.max(0.1, speed));
    return () => clearInterval(interval);
  }, [words, speed, loop, mode]);

  const gridWord = useMemo(() => {
    if (mode !== 'spread_grid' || words.length === 0) return null;
    const pageSize = matrix.rows * matrix.cols;
    const numPages = Math.ceil(words.length / pageSize);
    const pageDurationMs = (pageSize / Math.max(0.1, speed)) * 1000;
    return { pageSize, numPages, pageDurationMs };
  }, [mode, words.length, matrix.rows, matrix.cols, speed]);

  const [gridPage, setGridPage] = useState(0);

  useEffect(() => {
    if (!gridWord) return;
    setGridPage(0);
    const interval = setInterval(() => {
      setGridPage((prev) => {
        if (prev + 1 >= gridWord.numPages) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, gridWord.pageDurationMs);
    return () => clearInterval(interval);
  }, [gridWord, loop]);

  if (mode === 'marquee') {
    const duration = Math.max(3, text.length / Math.max(1, speed));
    return (
      <div className="w-full whitespace-nowrap overflow-hidden">
        <span
          className={cn(
            'inline-block font-cyber font-black tracking-widest uppercase',
            !fontSize && 'text-6xl md:text-8xl'
          )}
          style={{
            color: colorHex,
            fontSize: fontSize ? `${fontSize}px` : undefined,
            animation: `marquee ${duration}s linear ${loop ? 'infinite' : '1'}`,
          }}
        >
          {text}
        </span>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    );
  }

  if (mode === 'word_by_word') {
    const currentWord = words[wordIdx] || '';
    return (
      <span
        className={cn(
          'font-cyber font-black tracking-widest uppercase',
          !fontSize && 'text-7xl md:text-9xl'
        )}
        style={{
          color: colorHex,
          fontSize: fontSize ? `${fontSize}px` : undefined,
        }}
        key={wordIdx}
      >
        {currentWord}
      </span>
    );
  }

  if (mode === 'spread_grid') {
    if (!gridWord) return null;
    return (
      <div
        className="grid w-full h-full gap-4 p-8 animate-in fade-in duration-300"
        style={{
          gridTemplateColumns: `repeat(${matrix.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${matrix.rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: matrix.rows * matrix.cols }).map((_, idx) => {
          const wordIndex = gridPage * gridWord.pageSize + idx;
          const currentWord = words[wordIndex] || '';
          return (
            <div
              key={idx}
              className="flex items-center justify-center border border-white/5 rounded-2xl bg-black/40 p-4 min-h-24"
            >
              <span
                className={cn(
                  'font-cyber font-black tracking-widest uppercase text-center',
                  !fontSize && 'text-2xl md:text-4xl'
                )}
                style={{
                  color: colorHex,
                  fontSize: fontSize ? `${fontSize}px` : undefined,
                }}
                key={wordIndex}
              >
                {currentWord}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
