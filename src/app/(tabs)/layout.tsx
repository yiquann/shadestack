import { BottomNav } from "@/components/nav/BottomNav";
import { TryOnSessionProvider } from "@/lib/tryon/TryOnSessionContext";
import { SavedProvider } from "@/lib/saved/SavedContext";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TryOnSessionProvider>
      <SavedProvider>
        <div className="min-h-screen pb-20">
          {children}
          <BottomNav />
        </div>
      </SavedProvider>
    </TryOnSessionProvider>
  );
}
