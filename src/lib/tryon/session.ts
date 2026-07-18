import type { CatalogProduct } from "@/lib/catalog/types";

export type AppliedLayer = {
  category: CatalogProduct["category"];
  product: CatalogProduct;
  opacity: number;
  visible: boolean;
};

const DEFAULT_Z_ORDER: CatalogProduct["category"][] = [
  "FOUNDATION",
  "SETTING_POWDER",
  "BRONZER",
  "BLUSH",
  "HIGHLIGHTER",
  "EYESHADOW",
  "LIPSTICK",
];

export function applyProduct(layers: AppliedLayer[], product: CatalogProduct): AppliedLayer[] {
  const existingIndex = layers.findIndex((l) => l.category === product.category);
  if (existingIndex !== -1) {
    const next = [...layers];
    next[existingIndex] = { ...next[existingIndex], product };
    return next;
  }
  const rank = DEFAULT_Z_ORDER.indexOf(product.category);
  const insertAt = layers.findIndex((l) => DEFAULT_Z_ORDER.indexOf(l.category) > rank);
  const newLayer: AppliedLayer = { category: product.category, product, opacity: 1, visible: true };
  if (insertAt === -1) return [...layers, newLayer];
  return [...layers.slice(0, insertAt), newLayer, ...layers.slice(insertAt)];
}

export function removeLayer(
  layers: AppliedLayer[],
  category: CatalogProduct["category"]
): AppliedLayer[] {
  return layers.filter((l) => l.category !== category);
}

export function setOpacity(
  layers: AppliedLayer[],
  category: CatalogProduct["category"],
  opacity: number
): AppliedLayer[] {
  const clamped = Math.min(1, Math.max(0, opacity));
  return layers.map((l) => (l.category === category ? { ...l, opacity: clamped } : l));
}

export function toggleVisible(
  layers: AppliedLayer[],
  category: CatalogProduct["category"]
): AppliedLayer[] {
  return layers.map((l) => (l.category === category ? { ...l, visible: !l.visible } : l));
}

export function moveLayer(
  layers: AppliedLayer[],
  fromCategory: CatalogProduct["category"],
  toCategory: CatalogProduct["category"]
): AppliedLayer[] {
  const fromIndex = layers.findIndex((l) => l.category === fromCategory);
  const toIndex = layers.findIndex((l) => l.category === toCategory);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return layers;
  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function clearLook(): AppliedLayer[] {
  return [];
}

export type LookId = "A" | "B";
export type Looks = Record<LookId, AppliedLayer[]>;
export type ViewMode = "single" | "split";
export type StoredSession = { looks: Looks; mode: ViewMode };

export function emptyLooks(): Looks {
  return { A: [], B: [] };
}

/** Entering split seeds Look B from Look A (deep copy) when B is empty. */
export function withSplitEntered(looks: Looks): Looks {
  if (looks.B.length > 0) return looks;
  return { A: looks.A, B: looks.A.map((l) => ({ ...l })) };
}

function isLayerArray(v: unknown): v is AppliedLayer[] {
  return Array.isArray(v) && v.every((l) => l && typeof l === "object" && "category" in l);
}

/** Normalize a stored payload: v2 `{looks,mode}`, v1 bare `AppliedLayer[]`, or garbage. */
export function migrateStoredSession(parsed: unknown): StoredSession {
  if (isLayerArray(parsed)) {
    return { looks: { A: parsed, B: [] }, mode: "single" };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "looks" in parsed &&
    isLayerArray((parsed as StoredSession).looks?.A) &&
    isLayerArray((parsed as StoredSession).looks?.B)
  ) {
    const p = parsed as StoredSession;
    return { looks: { A: p.looks.A, B: p.looks.B }, mode: p.mode === "split" ? "split" : "single" };
  }
  return { looks: emptyLooks(), mode: "single" };
}
