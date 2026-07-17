import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(toCatalogProduct(product));
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
