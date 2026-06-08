'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GifItem = {
  slug: string;
  file?: {
    hd?: { gif?: { url: string; width: number; height: number } };
    md?: { gif?: { url: string; width: number; height: number } };
    sm?: { gif?: { url: string; width: number; height: number } };
    xs?: { gif?: { url: string; width: number; height: number } };
  };
  images?: {
    fixed_width?: { url: string; width: string; height: string };
    original?: { url: string; width: string; height: string };
  };
};

type GifSearchProps = {
  onSelect: (gif: { slug: string; url: string; width: number; height: number }) => void;
  selectedSlug?: string;
};

export function GifSearch({ onSelect, selectedSlug }: GifSearchProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchGifs = async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = q.trim()
        ? `/api/klipy/search?q=${encodeURIComponent(q)}&page=${p}&per_page=12`
        : `/api/klipy/trending?page=${p}&per_page=12`;
      
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error('Failed to fetch GIFs');
      }
      const data = await res.json();
      
      let list: GifItem[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && data.data) {
        if (Array.isArray(data.data)) {
          list = data.data;
        } else if (data.data.data && Array.isArray(data.data.data)) {
          list = data.data.data;
        }
      } else if (data && Array.isArray(data.results)) {
        list = data.results;
      }
      setGifs(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load GIFs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGifs(query, page);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, page]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Search GIFs via Klipy..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="font-cyber h-9 text-xs"
        />
        <a
          href="https://klipy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 rounded border border-white/10 bg-black/40 px-2.5 py-1.5 text-[8px] font-cyber uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white/20 transition-all"
        >
          <span>Powered by</span>
          <span className="font-black text-neon-magenta">KLIPY</span>
        </a>
      </div>

      {error && (
        <p className="text-[10px] text-red-500 font-cyber tracking-wide text-center mt-1 uppercase">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-xs font-cyber tracking-widest text-zinc-500 uppercase animate-pulse">
            Loading GIFs...
          </span>
        </div>
      ) : gifs.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-white/5 rounded-xl bg-black/10">
          <span className="text-xs font-cyber tracking-widest text-zinc-500 uppercase">
            No GIFs found
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[220px] pr-1">
          {gifs.map((gif) => {
            const isSelected = selectedSlug === gif.slug;
            const previewUrl =
              gif.file?.sm?.gif?.url ||
              gif.file?.xs?.gif?.url ||
              gif.images?.fixed_width?.url ||
              gif.images?.original?.url ||
              '';
            const originalUrl =
              gif.file?.hd?.gif?.url ||
              gif.file?.md?.gif?.url ||
              gif.images?.original?.url ||
              previewUrl ||
              '';
            const originalWidth =
              gif.file?.hd?.gif?.width ||
              gif.file?.md?.gif?.width ||
              (gif.images?.original?.width ? parseInt(gif.images.original.width) : 200);
            const originalHeight =
              gif.file?.hd?.gif?.height ||
              gif.file?.md?.gif?.height ||
              (gif.images?.original?.height ? parseInt(gif.images.original.height) : 200);

            return (
              <button
                key={gif.slug}
                type="button"
                onClick={() =>
                  onSelect({
                    slug: gif.slug,
                    url: originalUrl,
                    width: originalWidth,
                    height: originalHeight,
                  })
                }
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border bg-black/30 transition-all duration-300",
                  isSelected
                    ? "border-neon-cyan ring-2 ring-neon-cyan/20 scale-[0.98]"
                    : "border-white/5 hover:border-white/20 hover:scale-[1.01]"
                )}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={gif.slug}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 font-cyber">
                    No preview
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {gifs.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 px-3 text-[10px] font-cyber uppercase tracking-widest text-white border-white/10"
          >
            Prev
          </Button>
          <span className="text-[10px] font-cyber text-zinc-400">Page {page}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={gifs.length < 12}
            onClick={() => setPage((p) => p + 1)}
            className="h-7 px-3 text-[10px] font-cyber uppercase tracking-widest text-white border-white/10"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
