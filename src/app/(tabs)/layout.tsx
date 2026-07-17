import { BottomNav } from "@/components/nav/BottomNav";
import { TryOnSessionProvider } from "@/lib/tryon/TryOnSessionContext";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TryOnSessionProvider>
      <div className="min-h-screen pb-20">
        {children}
        <BottomNav />
      </div>
    </TryOnSessionProvider>
  );
}
