import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { TryOnView } from "@/components/tryon/TryOnView";

export default async function TryOnPage() {
  const products = await prisma.product.findMany();
  const catalogProducts = products.map(toCatalogProduct);

  return <TryOnView products={catalogProducts} />;
}
