import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col justify-center px-4 py-20">
      <div className="max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight">
          Sync lights across
          <span className="block text-orange-500">every screen</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400">
          Create a room, place phones in a matrix, and control colors like a lighting desk.
          Players join anonymously with a room code.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/room/new">
            <Button size="lg" className="w-full sm:w-auto">
              Create Room
            </Button>
          </Link>
          <Link href="/join">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Join Room
            </Button>
          </Link>
          <Link href="/standalone">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Standalone
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
