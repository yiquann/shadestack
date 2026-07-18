import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";

type Props = {
  product: CatalogProduct;
  onSelect: (product: CatalogProduct) => void;
  // Discover links to the Try On tab while adding; in-app (already on Try On)
  // it should just add without a same-page navigation.
  asLink?: boolean;
  look?: LookId;
};

export function ProductCard({ product, onSelect, asLink = true, look = "A" }: Props) {
  const { addProduct, mode } = useTryOnSession();
  const splitAdd = !asLink && mode === "split";
  const tryOnClass =
    "shrink-0 rounded-pill bg-chip px-3 py-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4 transition-colors duration-150 hover:bg-chip/40">
      <button
        onClick={() => onSelect(product)}
        className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <div
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-card"
          style={{
            background: `linear-gradient(145deg, ${product.colorHex}cc, ${product.colorHex})`,
            boxShadow:
              "inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.35)",
          }}
        >
          <span className="absolute bottom-1 right-1.5 text-[9px] font-bold uppercase leading-none text-white/70 [text-shadow:0_1px_1px_rgba(0,0,0,0.25)]">
            {product.brand.charAt(0)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{product.name}</p>
          <div className="flex min-w-0 items-baseline gap-1 text-xs text-textSecondary">
            <span className="truncate">{product.shade}</span>
            <span className="shrink-0 text-accent">· ${product.price}</span>
          </div>
        </div>
        <div
          className="h-6 w-6 shrink-0 rounded-full"
          style={{
            backgroundColor: product.colorHex,
            boxShadow:
              "inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.4)",
          }}
        />
      </button>
      {asLink ? (
        <Link
          href="/try-on"
          onClick={() => addProduct(product, look)}
          data-testid={`try-on-${product.id}`}
          className={tryOnClass}
        >
          Try On
        </Link>
      ) : splitAdd ? (
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => addProduct(product, "A")}
            data-testid={`try-on-a-${product.id}`}
            className={tryOnClass}
          >
            + A
          </button>
          <button
            type="button"
            onClick={() => addProduct(product, "B")}
            data-testid={`try-on-b-${product.id}`}
            className={tryOnClass}
          >
            + B
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => addProduct(product, look)}
          data-testid={`try-on-${product.id}`}
          className={tryOnClass}
        >
          Try On
        </button>
      )}
    </div>
  );
}
