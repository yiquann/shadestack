"use client";

import type { RenderLooks } from "./RenderCanvas";

const PILL =
  "pointer-events-none absolute bottom-2 z-30 rounded-pill bg-ink/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface backdrop-blur-sm";

/**
 * Which look each half of a split preview is showing, marked on the halves
 * themselves.
 *
 * This replaces a caption under the controls that read "*Left = Look A · Right =
 * Look B". That caption cost a row, and worse, it stated the mapping rather than
 * the current contents — so it did not survive a swap. These move with the
 * swap, because they are labelled from the same values that choose which
 * layers each half composites, so the answer is always on the thing the user is
 * looking at.
 *
 * Bottom corners, not top: the top ones already hold the photo's remove-✕ and
 * the before/after labels.
 */
export function LookPills({ looks }: { looks: RenderLooks }) {
  if (looks.mode !== "split") return null;
  return (
    <>
      <span className={`${PILL} left-2`} data-testid="look-pill-left">
        {looks.leftLook}
      </span>
      <span className={`${PILL} right-2`} data-testid="look-pill-right">
        {looks.rightLook}
      </span>
    </>
  );
}
