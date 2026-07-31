import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { DiscoverView } from "@/components/catalog/DiscoverView";

// Read the catalog at request time; prerendering would bake the DB contents
// into the build and require a reachable database during `next build`.
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const products = await prisma.product.findMany();
  const catalogProducts = products.map(toCatalogProduct);

  return (
    // overflow-y-auto, not hidden: the whole page scrolls (the product list no
    // longer has a scroller of its own). It scrolls *inside* the app shell, so
    // the tab bar below stays fixed in place while this content moves.
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-6">
      <DiscoverView products={catalogProducts} />
    </main>
  );
}
