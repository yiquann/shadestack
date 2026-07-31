import { BottomNav } from "@/components/nav/BottomNav";
import { TryOnSessionProvider } from "@/lib/tryon/TryOnSessionContext";
import { SavedProvider } from "@/lib/saved/SavedContext";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TryOnSessionProvider>
      <SavedProvider>
        {/* App shell: a column that is exactly one viewport tall, split between
            the page and the tab bar. The bar is a normal flow sibling, not a
            fixed overlay, so it cannot sit on top of the page's last row —
            whatever the viewport unit resolves to, the two divide that height
            between them rather than competing for it. Pages take the remaining
            space with `flex-1 min-h-0` and scroll internally if they need to. */}
        <div className="app-shell">
          {children}
          <BottomNav />
        </div>
      </SavedProvider>
    </TryOnSessionProvider>
  );
}
