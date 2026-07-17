import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { selectSimilarProducts } from "@/lib/catalog/similar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const target = await prisma.product.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const sameCategory = await prisma.product.findMany({
      where: { category: target.category },
    });
    const catalogProducts = sameCategory.map(toCatalogProduct);
    const targetCatalog = toCatalogProduct(target);
    const similar = selectSimilarProducts(catalogProducts, targetCatalog);
    return NextResponse.json(similar);
  } catch {
    return NextResponse.json({ error: "Failed to fetch similar products" }, { status: 500 });
  }
}
