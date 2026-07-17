import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { parseAndValidateProductQuery, applyProductQuery } from "@/lib/catalog/queryParams";

export async function GET(request: NextRequest) {
  const result = parseAndValidateProductQuery(request.nextUrl.searchParams);
  if (!result.valid) {
    return NextResponse.json({ error: result.errors.join(", ") }, { status: 400 });
  }

  try {
    const products = await prisma.product.findMany();
    const catalogProducts = products.map(toCatalogProduct);
    const filtered = applyProductQuery(catalogProducts, result.query);
    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
