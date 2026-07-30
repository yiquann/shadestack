export const ZONE_LANDMARKS = {
  lips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  // Eyeshadow ("eyes (lids)" zone per CLAUDE.md) must cover only the eyelid skin
  // between the lash line and the brow — NOT the full eye-opening contour. An
  // earlier version of this zone used MediaPipe's canonical FACEMESH_RIGHT_EYE /
  // FACEMESH_LEFT_EYE point sets (the full eye contour, i.e. the eyeball
  // opening), which visibly filled the entire eye including the white/iris —
  // confirmed via an exaggerated-opacity Playwright debug screenshot (solid red
  // covering the whole eye, not just the lid) and via a canvas pixel readback at
  // real opacity showing the sclera tinted cream instead of white. Fixed by
  // building a band between the upper-eyelid arc (lash line) and the lower brow
  // row (eyebrow's edge closest to the eye), both standard MediaPipe index
  // groups, ordered outer-corner -> inner-corner along the lash line then
  // inner -> outer back along the brow so the polygon traces a closed loop
  // without self-intersecting. The lash line is anchored at the TRUE eye
  // corners (33/263 outer, 133/362 inner) so the shadow's outer end lands on
  // the eye corner rather than short of it — an earlier version started one
  // point in from the outer corner, so the wing sat inboard of where the eye
  // actually ends.
  leftEye: [33, 246, 161, 160, 159, 158, 157, 173, 133, 55, 65, 52, 53, 46],
  rightEye: [263, 466, 388, 387, 386, 385, 384, 398, 362, 285, 295, 282, 283, 276],
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  leftCheek: [50, 101, 118, 187, 205, 36],
  rightCheek: [280, 330, 347, 411, 425, 266],
  forehead: [109, 10, 338, 296, 336, 285, 8, 55, 107],
  jawline: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361],
  // Bronzer zones (the classic contour placement): the outer cheekbone — a
  // streak lateral to and above the blush apple, angled up toward the ear — and
  // the temples/sides of the hairline. Deliberately NOT the whole jaw perimeter
  // or the center forehead (that read as a muddy lower-face + forehead-center
  // wash). Cheekbone points sit just outside the blush apple (leftCheek/
  // rightCheek) so the two products meet at the cheek's outer edge; temple
  // points hug the lateral hairline drawn from the top of faceOval.
  leftCheekbone: [117, 116, 123, 187, 118],
  rightCheekbone: [346, 345, 352, 411, 347],
  leftTemple: [21, 54, 103, 67, 104, 68],
  rightTemple: [251, 284, 332, 297, 333, 298],
} as const;

export type ZoneName = keyof typeof ZONE_LANDMARKS;
