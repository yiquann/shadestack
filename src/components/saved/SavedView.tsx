"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { SavedLook } from "@/lib/saved/savedCollection";
import { useSaved } from "@/lib/saved/SavedContext";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ProductList } from "@/components/catalog/ProductList";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";
import { PageTitle } from "@/components/nav/PageTitle";
import { SavedLookCard } from "./SavedLookCard";

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted";

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-card border border-border bg-surface px-6 py-10 text-center">
      <span className="text-3xl text-textFaint" aria-hidden>
        ♡
      </span>
      <p className="max-w-xs text-xs text-textMuted">{text}</p>
    </div>
  );
}

export function SavedView() {
  const { products, looks, deleteLook } = useSaved();
  const { replaceLook, setMode, setSource } = useTryOnSession();
  const router = useRouter();
  const [selected, setSelected] = useState<CatalogProduct | null>(null);

  function applyLook(look: SavedLook) {
    replaceLook("A", look.layers);
    setMode("single");
    // Open Try On on the live camera so the look previews on the user's face.
    setSource("camera");
    router.push("/try-on");
  }

  return (
    // This tab scrolls (unlike Discover/Try On). It scrolls *internally* within
    // the app shell rather than scrolling the document, so the tab bar below
    // stays put and needs no padding reserved for it.
    <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
      <PageTitle>Saved</PageTitle>

      <section className="mt-6">
        <h2 className={SECTION_LABEL}>Saved Looks</h2>
        {looks.length === 0 ? (
          <EmptyState text="No saved looks yet. Build a look on Try On and tap Save Look." />
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {looks.map((l) => (
              <SavedLookCard
                key={l.id}
                look={l}
                onApply={() => applyLook(l)}
                onDelete={() => deleteLook(l.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className={SECTION_LABEL}>Saved Products</h2>
        {products.length === 0 ? (
          <EmptyState text="No saved products yet. Tap the heart on a product to save it." />
        ) : (
          <div className="mt-3 overflow-hidden rounded-card border border-border">
            <ProductList products={products} onSelect={setSelected} />
          </div>
        )}
      </section>

      {selected && (
        <ProductDetailSheet product={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
