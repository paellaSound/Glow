import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UserAccountMenu } from '@/components/glow/user-account-menu';
import { CircleIcon } from 'lucide-react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <CircleIcon className="size-6 text-orange-500" />
            <span className="text-xl font-semibold">GLOW</span>
          </Link>
          <Link href="/billing">
            <Button variant="ghost">Billing</Button>
          </Link>
        </div>
      </header>
      {children}
      <UserAccountMenu />
    </div>
  );
}
