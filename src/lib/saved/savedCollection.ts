import type { CatalogProduct } from "@/lib/catalog/types";
import type { AppliedLayer } from "@/lib/tryon/session";

export type SavedLook = {
  id: string;
  name: string;
  layers: AppliedLayer[];
  createdAt: string; // ISO timestamp
};

export type SavedState = {
  products: CatalogProduct[];
  looks: SavedLook[];
};

export function emptySaved(): SavedState {
  return { products: [], looks: [] };
}

export function isProductSaved(state: SavedState, id: string): boolean {
  return state.products.some((p) => p.id === id);
}

/** Toggle a product in the saved list; newest first. */
export function toggleProduct(state: SavedState, product: CatalogProduct): SavedState {
  return isProductSaved(state, product.id)
    ? { ...state, products: state.products.filter((p) => p.id !== product.id) }
    : { ...state, products: [product, ...state.products] };
}

/** Prepend a look, deep-copying its layers so it never aliases live session state. */
export function addLook(state: SavedState, look: SavedLook): SavedState {
  const copy: SavedLook = { ...look, layers: look.layers.map((l) => ({ ...l })) };
  return { ...state, looks: [copy, ...state.looks] };
}

export function deleteLook(state: SavedState, id: string): SavedState {
  return { ...state, looks: state.looks.filter((l) => l.id !== id) };
}

function isProduct(v: unknown): v is CatalogProduct {
  return !!v && typeof v === "object" && "id" in v && "category" in v && "colorHex" in v;
}

function isLook(v: unknown): v is SavedLook {
  return (
    !!v &&
    typeof v === "object" &&
    "id" in v &&
    "name" in v &&
    Array.isArray((v as SavedLook).layers)
  );
}

/** Normalize a stored payload, dropping anything malformed. */
export function migrateSaved(parsed: unknown): SavedState {
  if (!parsed || typeof parsed !== "object") return emptySaved();
  const p = parsed as { products?: unknown; looks?: unknown };
  return {
    products: Array.isArray(p.products) ? p.products.filter(isProduct) : [],
    looks: Array.isArray(p.looks) ? p.looks.filter(isLook) : [],
  };
}
