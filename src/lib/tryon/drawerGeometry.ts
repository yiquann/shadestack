/** Viewport measurements the drawer needs, read once per visualViewport event. */
export type ViewportMetrics = {
  /** Layout viewport height — `window.innerHeight`. Unaffected by the keyboard. */
  innerHeight: number;
  /** Visible viewport height — `visualViewport.height`, or `innerHeight` as a fallback. */
  viewportHeight: number;
  /** Visible viewport top offset — `visualViewport.offsetTop`, or 0 as a fallback. */
  viewportOffsetTop: number;
};

export type DrawerGeometry = {
  /** px between the layout viewport bottom and the drawer's bottom edge — the keyboard. */
  bottomInset: number;
  /** px height of the drawer panel. */
  height: number;
  /** Whether visible space remains above the panel for a tappable scrim. */
  hasScrim: boolean;
};

/** The drawer prefers half the screen… */
const HEIGHT_FRACTION = 0.5;

/** …but never less than enough to show this many product rows at once. */
const VISIBLE_ROWS = 4;
/** One ProductCard: `min-h-[94px]`, border included (border-box). */
const ROW_HEIGHT = 94;
/**
 * Everything stacked above the list: the 24px gripper, the 54px search field
 * block, and the 24px "Adding to Look B" caption. The caption only renders when
 * both looks exist, so budgeting for it means four rows fit in every one of the
 * four drawers (Look A / Look B x view / add), not just the captionless ones.
 */
const CHROME_HEIGHT = 24 + 54 + 24;

/** Half a screen is under four rows on a typical phone (426px showed 3.7). */
export const MIN_DRAWER_HEIGHT = VISIBLE_ROWS * ROW_HEIGHT + CHROME_HEIGHT;

/**
 * Positions the drawer above the on-screen keyboard. The height is the larger of
 * the half-screen preference and the four-row minimum, then clamped to the
 * visible viewport so a tall keyboard lifts the panel without ever pushing its
 * top edge off-screen; when that clamp bites there is no scrim left.
 */
export function computeDrawerGeometry({
  innerHeight,
  viewportHeight,
  viewportOffsetTop,
}: ViewportMetrics): DrawerGeometry {
  const bottomInset = Math.max(0, innerHeight - viewportHeight - viewportOffsetTop);
  const preferred = Math.max(HEIGHT_FRACTION * innerHeight, MIN_DRAWER_HEIGHT);
  const height = Math.min(preferred, viewportHeight);
  return { bottomInset, height, hasScrim: height < viewportHeight };
}

/** A gripper drag at the moment the pointer is released. */
export type DragRelease = {
  /** Downward drag distance in px. Negative means the user dragged up. */
  deltaY: number;
  /** Panel height in px, from `computeDrawerGeometry`. */
  height: number;
  /** Downward speed at release, in px/ms. */
  velocity: number;
};

/** Close once dragged past this fraction of the panel height… */
const CLOSE_DISTANCE_FRACTION = 0.25;
/** …or when flicked down at least this fast, whatever the distance. */
const CLOSE_VELOCITY = 0.5;

export function resolveDrag({ deltaY, height, velocity }: DragRelease): "close" | "snap-back" {
  // Upward drag is never a dismissal — the drawer cannot grow past its cap.
  if (deltaY <= 0) return "snap-back";
  if (deltaY > height * CLOSE_DISTANCE_FRACTION) return "close";
  if (velocity > CLOSE_VELOCITY) return "close";
  return "snap-back";
}
