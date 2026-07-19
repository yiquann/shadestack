# Camera Ring Light — Design

**Date:** 2026-07-18
**Status:** Approved
**Scope:** Single file — `src/components/tryon/CameraSource.tsx`

## Goal

Add a **functional screen-emitted fill light** to the live Camera try-on. When enabled,
the screen renders a thick ring of solid bright white pixels around the camera preview.
That emitted light reflects onto the user's face — the same principle as a physical ring
light — so composited makeup colors read more accurately against real skin.

This is a functional lighting aid, not a decorative accent.

## Decisions

- **Purpose:** Functional fill light (emits real light), not a decorative glow.
- **Control:** Simple on/off toggle. No brightness/warmth sliders (YAGNI).
- **Ring form:** Solid bright frame — a band of solid white pixels, not a translucent halo.
  Solid pixels emit meaningfully more light than a `box-shadow` bloom alone.
- **Color temperature:** Neutral bright white (`surface` token, `#FFFFFF`). Warm tones
  would color-shift the very shades the user is trying to judge; real makeup ring lights
  are daylight-balanced (~5500K neutral) for this reason.
- **Default:** Off.
- **Persistence:** None — session-only local state. Can revisit later if desired.
- **Applicability:** Camera mode only. Photo and Model modes use uploaded/illustrated
  images; a screen fill light only helps a live camera feed.

## UI

### Toggle button
- Small pill button positioned **top-right** of the preview card (top-left is occupied by
  the dev FPS badge).
- Uses `pointer-events-auto` (the video and canvases are non-interactive).
- Off state: translucent dark pill (`bg-ink/60`), muted icon/label — matches the existing
  FPS badge treatment.
- On state: bright `surface` pill with `ink` text — reads as "active".
- Icon: a ring/sun glyph plus a short label ("Ring Light" or just the icon on narrow widths).

### The ring
- A solid `#FFFFFF` (`surface` token) rounded panel positioned **behind** the preview card,
  inset by roughly `-28px` (`-inset-7`), with a slightly larger corner radius than the card.
- Because the card (`rounded-card bg-ink` holding the video) sits on top, only a ~28px band
  of bright white shows around all four edges — the light-emitting surface.
- A soft outer bloom via `box-shadow` (translucent white, large blur/spread) extends past the
  band and fades into the dark backdrop, so the ring reads as emitted light rather than a hard
  border.
- Rendered only when `ringLight` is on.

### Layering
```
wrapper (relative)
├── ring panel        (absolute, -inset-7, bg-surface, box-shadow bloom)  z-0   [when on]
└── preview card      (relative, rounded-card, bg-ink)                    z-10
    ├── <video>
    ├── <canvas> render
    ├── <canvas> divider
    ├── FPS badge     (top-left)
    └── ring toggle   (top-right, pointer-events-auto)
```
The preview card must establish a stacking context above the ring panel so the video is
never covered by the white band.

## State & data flow

- Add `const [ringLight, setRingLight] = useState(false);` in `CameraSource`.
- Toggle button flips it. No props threaded from the parent — fully local, camera-scoped.
- No change to the render/detection loop, landmarks, WebGL compositor, or masks.

## Design tokens

- Ring fill: `surface` (`#FFFFFF`) — this token *is* the intended light color.
- Toggle off pill: `ink` at 60% (`bg-ink/60`), text `surface` — matches FPS badge.
- Toggle on pill: `bg-surface`, text `ink`.
- Bloom: translucent white via `box-shadow` (functional light spill; not a brand surface).

## Testing / verification

Primarily a visual UI toggle with no logic branches worth unit-testing. Verify by running
the app in Camera mode:
1. Toggle defaults to off; no ring visible.
2. Tapping the toggle shows the solid white ring + bloom; button switches to active state.
3. Tapping again removes it.
4. The video preview and composited layers remain fully visible (card is never covered).
5. FPS is unaffected (the ring is static DOM/CSS, outside the render loop).

## Out of scope

- Brightness / warmth / color-temperature controls.
- Persisting the on/off choice across sessions.
- Ring light in Photo or Model modes.
- Any change to the WebGL render pipeline.
