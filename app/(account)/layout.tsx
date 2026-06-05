import { UserAccountMenu } from '@/components/glow/user-account-menu';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
      <UserAccountMenu />
    </div>
  );
}
