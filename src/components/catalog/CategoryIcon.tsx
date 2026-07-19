import {
  FoundationMakeup,
  FacePowder,
  Lipstick,
  CosmeticBrush,
  Powder,
  Mascara,
  Makeups,
} from "@icon-park/react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { DESIGN_TOKENS } from "@/lib/tokens";

// IconPark exposes each icon as a component with this shape.
type IconP600Component = typeof Lipstick;

// Product-type glyph per category. IconPark carries dedicated foundation,
// (compact) powder, and lipstick icons; no open icon set has distinct
// blush/bronzer/highlighter/eyeshadow makeup symbols, so those four map to the
// closest cosmetic icon (a brush, a powder, an eye product, generic makeup).
// Swapping any mapping is a one-line change here.
const CATEGORY_ICON: Record<CatalogProduct["category"], IconP600Component> = {
  FOUNDATION: FoundationMakeup,
  SETTING_POWDER: FacePowder,
  LIPSTICK: Lipstick,
  BLUSH: CosmeticBrush,
  BRONZER: Powder,
  EYESHADOW: Mascara,
  HIGHLIGHTER: Makeups,
};

type Props = {
  category: CatalogProduct["category"];
  size?: number;
};

export function CategoryIcon({ category, size = 28 }: Props) {
  const Icon = CATEGORY_ICON[category];
  return (
    <Icon
      theme="outline"
      size={size}
      fill={DESIGN_TOKENS.colors.ink}
      strokeWidth={3}
      aria-hidden
    />
  );
}
