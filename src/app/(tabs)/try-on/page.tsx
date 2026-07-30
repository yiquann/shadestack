import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { TryOnView } from "@/components/tryon/TryOnView";

// Read the catalog at request time; prerendering would bake the DB contents
// into the build and require a reachable database during `next build`.
export const dynamic = "force-dynamic";

export default async function TryOnPage() {
  const products = await prisma.product.findMany();
  const catalogProducts = products.map(toCatalogProduct);

  return <TryOnView products={catalogProducts} />;
}
