import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CircleIcon } from 'lucide-react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <CircleIcon className="size-6 text-orange-500" />
            <span className="text-xl font-semibold">GLOW</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/billing">
              <Button variant="ghost">Billing</Button>
            </Link>
            <Link href="/sign-in">
              <Button>Sign In</Button>
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
