import type { LookId, Looks, ViewMode } from "./session";

/**
 * Which look single view renders.
 *
 * Look B can only be filled in split view, so a session where B has products
 * and A does not is reachable two ways: opening split before adding anything
 * and only ever adding to B, or building both and then clearing A. Rendering
 * Look A unconditionally would show those users the bare face with their
 * products nowhere on screen — the app would look like it had eaten them.
 *
 * Falls back to A when neither look has anything, so an empty session still has
 * a well-defined target for the first product.
 */
export function primaryLook(looks: Looks): LookId {
  if (looks.A.length > 0) return "A";
  if (looks.B.length > 0) return "B";
  return "A";
}

/** Whether any product is applied at all, in either look. */
export function hasAnyProducts(looks: Looks): boolean {
  return looks.A.length > 0 || looks.B.length > 0;
}

/** Which of the dock's top-row actions are available right now. */
export type DockActions = {
  /** Exchange the two halves. Split only — single view has nothing to exchange. */
  swap: boolean;
  /** Split divider / single before-after wipe. */
  orientation: boolean;
  /** Open the save sheet. */
  save: boolean;
};

/**
 * Note that `orientation` and `save` share one condition across both modes,
 * rather than single view asking about Look A alone. That works because single
 * view renders `primaryLook` rather than always Look A: whenever any product
 * exists, the face on screen is showing it. So there is no state where products
 * are applied but these two controls are dead.
 */
export function dockActions(mode: ViewMode, looks: Looks): DockActions {
  const any = hasAnyProducts(looks);
  return {
    swap: mode === "split",
    orientation: any,
    save: any,
  };
}

/**
 * Which chip to flag briefly on entering split view, or null for no highlight.
 *
 * Entering split has two quite different outcomes, and only one of them needs
 * explaining:
 *
 * - Exactly one look populated — that look's half of the face gets makeup and
 *   the other half is bare. The highlight answers "why is only half my face
 *   made up, and which look owns it."
 * - Both populated — the user built a Look B earlier and saw it dimmed in single
 *   view. Both halves come up at once, both chips are live, and nothing was
 *   assigned. A highlight here would imply something just moved, which is false.
 * - Neither populated — nothing happened; there is nothing to point at.
 *
 * Nothing is ever moved or reassigned in either direction, so this is purely
 * about making a state that already exists visible.
 */
export function entryHighlight(looks: Looks): LookId | null {
  const a = looks.A.length > 0;
  const b = looks.B.length > 0;
  if (a && b) return null;
  if (a) return "A";
  if (b) return "B";
  return null;
}

/** One chip in the dock's second row. */
export type LookSlot = {
  /** Which look this chip targets. */
  look: LookId;
  /** Chip label. Carries no product count — just the look. */
  label: string;
  /**
   * Live chips can be added to. A dimmed chip's label still opens its look
   * read-only, but its `＋` is inert: adding to a look that is not on screen is
   * exactly the silent reassignment this design rules out.
   */
  live: boolean;
};

/**
 * Row 2's contents. One row in every state — only its shape changes, and both
 * shapes are a single row of chips, so the dock's height never moves.
 *
 * Split renders both looks in the order they appear on the face, so a chip's
 * position always describes its half; swapping exchanges the contents rather
 * than moving the chips.
 *
 * Single renders one chip — labelled just `Look`, whichever look it targets,
 * because one look and one chip is the same situation to the user whether the
 * products happen to live in A or in B. The exception is both looks being
 * populated: hiding a Look B the user just built would leave nothing on screen
 * to account for it, so it stays, dimmed.
 */
export function lookSlots(mode: ViewMode, looks: Looks, swapped: boolean): LookSlot[] {
  if (mode === "split") {
    const order: LookId[] = swapped ? ["B", "A"] : ["A", "B"];
    return order.map((look) => ({ look, label: `Look ${look}`, live: true }));
  }
  if (looks.A.length > 0 && looks.B.length > 0) {
    return [
      { look: "A", label: "Look A", live: true },
      { look: "B", label: "Look B", live: false },
    ];
  }
  return [{ look: primaryLook(looks), label: "Look", live: true }];
}
