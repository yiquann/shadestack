export const DESIGN_TOKENS = {
  colors: {
    bg: "#FAF6F2",
    ink: "#1C1210",
    accent: "#C4916C",
    accentHover: "#A67656",
    chip: "#F3E8E0",
    chipHover: "#E8DDD4",
    textSecondary: "#6B5E56",
    textMuted: "#9A8B82",
    textFaint: "#B8ADA5",
    border: "#EDE5DD",
    surface: "#FFFFFF",
    // The one "pressed back" chip fill, shared by hover and unavailable: a
    // control is either at rest or not. Not from the original prototype palette,
    // which had no neutral and whose chipHover step was too small to register.
    chipStrong: "#DCD6D0",
  },
  gradients: {
    cameraBackdrop: "linear-gradient(160deg, #1a1410, #0f0c08, #1a1410)",
    heroBanner: "linear-gradient(135deg, #1C1210, #3B2518)",
  },
  fonts: {
    display: "DM Serif Display",
    body: "DM Sans",
  },
  radii: {
    card: "16px",
    pill: "20px",
    sheet: "24px 24px 0 0",
  },
  shadow: {
    card: "0 2px 8px rgba(28,18,16,0.07)",
    cardHover: "0 4px 14px rgba(28,18,16,0.12)",
  },
} as const;
