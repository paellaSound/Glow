'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { CreditCard, Home, Layers, LogOut, PlusCircle, Radio, Sliders, User, XCircle } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';
import { ThemeMenuItems } from '@/components/glow/theme-menu-items';
import { useActiveRoom, useEndActiveRoom } from '@/components/glow/ongoing-session-banner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type UserApiResponse = {
  user: {
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  team: {
    plan: {
      name: string;
    };
  } | null;
};

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function MenuTrigger({
  children,
  label,
  variant,
  showLiveDot,
}: {
  children: React.ReactNode;
  label: string;
  variant: 'floating' | 'inline';
  showLiveDot?: boolean;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={label}
        className={
          variant === 'inline'
            ? 'relative flex size-9 items-center justify-center rounded-full border border-border/60 bg-background/60 transition hover:border-neon-cyan/40 hover:bg-accent/50'
            : 'relative flex size-12 items-center justify-center rounded-full border border-border bg-card shadow-lg ring-2 ring-orange-500/30 transition hover:ring-orange-500/60'
        }
      >
        {children}
        {showLiveDot ? (
          <span
            className="absolute bottom-6 left-6 size-2.5 rounded-full bg-green-500 ring-2 ring-background"
            aria-hidden
          />
        ) : null}
      </button>
    </DropdownMenuTrigger>
  );
}

type UserAccountMenuProps = {
  variant?: 'floating' | 'inline';
};

export function UserAccountMenu({ variant = 'floating' }: UserAccountMenuProps) {
  const { data } = useSWR<UserApiResponse>('/api/user', fetcher);
  const { data: activeRoom } = useActiveRoom();
  const { endSession, ending } = useEndActiveRoom(activeRoom?.roomCode);
  const isInline = variant === 'inline';
  const hasLiveSession = Boolean(activeRoom?.roomCode);

  if (isInline && !data?.user) {
    return null;
  }

  const menu = (
    <DropdownMenu>
      {!data?.user ? (
        <MenuTrigger label="Account menu" variant={variant}>
          <User className="size-5 text-muted-foreground" />
        </MenuTrigger>
      ) : (
        <MenuTrigger label="Account menu" variant={variant} showLiveDot={hasLiveSession}>
          <Avatar className={isInline ? 'size-8' : 'size-11'}>
            <AvatarImage
              src={data.user.avatarUrl ?? undefined}
              alt={data.user.fullName ?? data.user.email}
            />
            <AvatarFallback className="bg-orange-500/20 text-sm font-medium text-orange-600 dark:text-orange-200">
              {getInitials(data.user.fullName, data.user.email)}
            </AvatarFallback>
          </Avatar>
        </MenuTrigger>
      )}

      <DropdownMenuContent
        side={isInline ? 'bottom' : 'top'}
        align="end"
        className="w-56"
      >
        {data?.user ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{data.user.fullName ?? data.user.email}</span>
                <span className="text-xs text-muted-foreground">
                  {data.team?.plan?.name ?? 'Free'} plan
                </span>
              </div>
            </DropdownMenuLabel>
            {hasLiveSession && activeRoom?.roomCode ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-cyber uppercase tracking-widest text-green-500">
                  Live · {activeRoom.roomCode}
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/room/${activeRoom.roomCode}/control`} className="cursor-pointer">
                    <Radio />
                    Resume session
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={ending}
                  onSelect={(event) => {
                    event.preventDefault();
                    void endSession();
                  }}
                >
                  <XCircle />
                  {ending ? 'Ending session…' : 'End session'}
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/billing" className="cursor-pointer">
                <CreditCard />
                Billing & plan
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/rigs" className="cursor-pointer">
                <Sliders />
                My Rigs
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pattern-sequences" className="cursor-pointer">
                <Layers />
                Pattern Sequences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/room/new" className="cursor-pointer">
                <PlusCircle />
                Create room
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/" className="cursor-pointer">
                <Home />
                Home
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/auth/signin" className="cursor-pointer">
                <User />
                Sign in
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {!isInline ? <ThemeMenuItems /> : null}

        {data?.user ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="p-0"
              onSelect={(event) => event.preventDefault()}
            >
              <form action={signOut} className="w-full">
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm"
                >
                  <LogOut />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isInline) {
    return menu;
  }

  return (
    <div className="fixed right-4 z-50 bottom-[max(1rem,env(safe-area-inset-bottom))]">
      {menu}
    </div>
  );
}
