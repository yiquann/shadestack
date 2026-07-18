import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { DiscoverView } from "@/components/catalog/DiscoverView";

export default async function DiscoverPage() {
  const products = await prisma.product.findMany();
  const catalogProducts = products.map(toCatalogProduct);

  return (
    <main className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden px-5 pt-6">
      <DiscoverView products={catalogProducts} />
    </main>
  );
}
