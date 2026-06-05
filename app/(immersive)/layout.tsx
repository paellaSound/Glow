export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-black text-white">{children}</div>;
}
