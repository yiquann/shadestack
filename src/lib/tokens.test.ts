import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS } from "./tokens";

describe("DESIGN_TOKENS", () => {
  it("has the exact color values from the CLAUDE.md design system", () => {
    expect(DESIGN_TOKENS.colors.bg).toBe("#FAF6F2");
    expect(DESIGN_TOKENS.colors.ink).toBe("#1C1210");
    expect(DESIGN_TOKENS.colors.accent).toBe("#C4916C");
    expect(DESIGN_TOKENS.colors.accentHover).toBe("#A67656");
    expect(DESIGN_TOKENS.colors.chip).toBe("#F3E8E0");
    expect(DESIGN_TOKENS.colors.chipHover).toBe("#E8DDD4");
    expect(DESIGN_TOKENS.colors.textSecondary).toBe("#6B5E56");
    expect(DESIGN_TOKENS.colors.textMuted).toBe("#9A8B82");
    expect(DESIGN_TOKENS.colors.textFaint).toBe("#B8ADA5");
    expect(DESIGN_TOKENS.colors.border).toBe("#EDE5DD");
    expect(DESIGN_TOKENS.colors.surface).toBe("#FFFFFF");
  });

  it("has the two dark gradients", () => {
    expect(DESIGN_TOKENS.gradients.cameraBackdrop).toBe(
      "linear-gradient(160deg, #1a1410, #0f0c08, #1a1410)"
    );
    expect(DESIGN_TOKENS.gradients.heroBanner).toBe(
      "linear-gradient(135deg, #1C1210, #3B2518)"
    );
  });

  it("has display and body font families", () => {
    expect(DESIGN_TOKENS.fonts.display).toBe("DM Serif Display");
    expect(DESIGN_TOKENS.fonts.body).toBe("DM Sans");
  });

  it("every color value is a valid 6-digit hex", () => {
    for (const value of Object.values(DESIGN_TOKENS.colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
