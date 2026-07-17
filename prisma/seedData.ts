export type SeedProduct = {
  category:
    | "FOUNDATION"
    | "BLUSH"
    | "BRONZER"
    | "HIGHLIGHTER"
    | "EYESHADOW"
    | "LIPSTICK"
    | "SETTING_POWDER";
  name: string;
  brand: string;
  shade: string;
  colorHex: string;
  price: number;
  coverage: string;
  finish: string;
  skinType: string;
  desc: string;
};

export const seedProducts: SeedProduct[] = [
  // FOUNDATION
  { category: "FOUNDATION", name: "Luminous Silk Foundation", brand: "Giorgio Armani", shade: "4 Light", colorHex: "#E8C8A4", price: 68, coverage: "Medium", finish: "Luminous", skinType: "All skin types", desc: "A weightless foundation that blurs pores and evens tone with a lit-from-within glow." },
  { category: "FOUNDATION", name: "Pro Filt'r Soft Matte", brand: "Fenty Beauty", shade: "220", colorHex: "#D9A876", price: 40, coverage: "Full", finish: "Matte", skinType: "Oily", desc: "Long-wearing full coverage that controls shine without looking cakey." },
  { category: "FOUNDATION", name: "Double Wear Stay-in-Place", brand: "Estée Lauder", shade: "2W1.5 Natural Suede", colorHex: "#C99B72", price: 46, coverage: "Full", finish: "Matte", skinType: "Combination", desc: "24-hour wear foundation that resists heat, humidity, and sweat." },
  { category: "FOUNDATION", name: "Teint Idole Ultra Wear", brand: "Lancôme", shade: "310C", colorHex: "#B98A63", price: 52, coverage: "Buildable", finish: "Matte", skinType: "All skin types", desc: "Buildable coverage that stays fresh for 24 hours without feeling heavy." },

  // BLUSH
  { category: "BLUSH", name: "Cheek to Chic Blush", brand: "Charlotte Tilbury", shade: "Pillow Talk", colorHex: "#E8A0A0", price: 40, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A dual-tone blush that mimics the natural flush of glowing cheeks." },
  { category: "BLUSH", name: "Watercolour Blush", brand: "Clinique", shade: "Berry Pop", colorHex: "#D46A7E", price: 30, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "A gel-cream blush that blends like a wash of watercolor." },
  { category: "BLUSH", name: "Soft Pinch Liquid Blush", brand: "Rare Beauty", shade: "Joy", colorHex: "#E88A9A", price: 23, coverage: "Buildable", finish: "Dewy", skinType: "All skin types", desc: "A weightless liquid blush that blends into a soft, healthy flush." },
  { category: "BLUSH", name: "Powder Blush", brand: "NARS", shade: "Orgasm", colorHex: "#E8927E", price: 32, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "The cult-classic peachy-pink blush with a golden shimmer." },

  // BRONZER
  { category: "BRONZER", name: "Hoola Matte Bronzer", brand: "Benefit", shade: "Original", colorHex: "#A87552", price: 32, coverage: "Buildable", finish: "Matte", skinType: "All skin types", desc: "A completely matte bronzer for natural-looking definition." },
  { category: "BRONZER", name: "Sun Dew Bronzing Serum", brand: "Fenty Beauty", shade: "Sun Stalla", colorHex: "#B87F55", price: 39, coverage: "Light", finish: "Dewy", skinType: "Dry", desc: "A hybrid bronzer-serum that melts into skin for a lit-from-within warmth." },
  { category: "BRONZER", name: "Soleil Tan de Chanel", brand: "Chanel", shade: "Universel", colorHex: "#C08A5E", price: 62, coverage: "Buildable", finish: "Luminous", skinType: "All skin types", desc: "A silky bronzing powder for a healthy, sun-kissed complexion." },
  { category: "BRONZER", name: "Terracotta Light Bronzer", brand: "Guerlain", shade: "01 Light Warm", colorHex: "#BC8863", price: 55, coverage: "Buildable", finish: "Matte", skinType: "All skin types", desc: "An iconic bronzing powder with a natural, sculpted warmth." },

  // HIGHLIGHTER
  { category: "HIGHLIGHTER", name: "Killawatt Freestyle Highlighter", brand: "Fenty Beauty", shade: "Trophy Wife", colorHex: "#F0D8B8", price: 38, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "An intensely pigmented highlighter for a metallic, sculpted glow." },
  { category: "HIGHLIGHTER", name: "Strobe Cream", brand: "MAC", shade: "Silverlite", colorHex: "#EFE2D6", price: 34, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "A luminizing cream that adds a soft, radiant sheen to skin." },
  { category: "HIGHLIGHTER", name: "Glow Kit", brand: "Anastasia Beverly Hills", shade: "Sun Dipped", colorHex: "#EAC9A0", price: 40, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A finely-milled powder highlighter for an intense golden glow." },
  { category: "HIGHLIGHTER", name: "Hydra Glow Highlighting Powder", brand: "NARS", shade: "Fort de France", colorHex: "#F2DCC2", price: 46, coverage: "Light", finish: "Luminous", skinType: "Dry", desc: "A hydrating highlighter that leaves skin looking dewy and refreshed." },

  // EYESHADOW
  { category: "EYESHADOW", name: "Naked Eyeshadow Palette", brand: "Urban Decay", shade: "Buzz", colorHex: "#C9A876", price: 21, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A warm bronze shimmer shade for a sultry, smoky look." },
  { category: "EYESHADOW", name: "Modern Renaissance Palette", brand: "Anastasia Beverly Hills", shade: "Vermeer", colorHex: "#8B4A3D", price: 12, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A deep burnt-red matte shade perfect for warm smoky eyes." },
  { category: "EYESHADOW", name: "Eyeshadow Quad", brand: "Chanel", shade: "Tisse Venise", colorHex: "#B08968", price: 64, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A coordinated quad of golden-taupe shades for effortless definition." },
  { category: "EYESHADOW", name: "Mono Eyeshadow", brand: "Pat McGrath Labs", shade: "Bronze Ambition", colorHex: "#A6693E", price: 25, coverage: "Full", finish: "Shimmer", skinType: "All skin types", desc: "A richly pigmented single shade with a metallic foil finish." },

  // LIPSTICK
  { category: "LIPSTICK", name: "Rouge Pur Couture", brand: "Yves Saint Laurent", shade: "1 Le Rouge", colorHex: "#B23A3A", price: 39, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A vivid matte red with a comfortable, non-drying formula." },
  { category: "LIPSTICK", name: "Soft Matte Lip Cream", brand: "NARS", shade: "Rikugien", colorHex: "#C4726B", price: 28, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A featherweight liquid lipstick with an ultra-matte, non-drying finish." },
  { category: "LIPSTICK", name: "Lip Glow Balm", brand: "Dior", shade: "004 Coral", colorHex: "#E37B6D", price: 40, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "A tinted lip balm that adapts to your natural lip tone with a glossy finish." },
  { category: "LIPSTICK", name: "Matte Revolution Lipstick", brand: "Charlotte Tilbury", shade: "Pillow Talk", colorHex: "#C48A80", price: 38, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A nude-pink matte lipstick with a soft-focus, blurring effect." },

  // SETTING_POWDER
  { category: "SETTING_POWDER", name: "Airspun Loose Powder", brand: "Coty", shade: "Translucent", colorHex: "#F2E4D2", price: 8, coverage: "Light", finish: "Matte", skinType: "All skin types", desc: "A classic finely-milled loose powder that sets makeup without adding color." },
  { category: "SETTING_POWDER", name: "All Nighter Setting Powder", brand: "Urban Decay", shade: "Translucent", colorHex: "#F0E2D0", price: 39, coverage: "Light", finish: "Matte", skinType: "Oily", desc: "A weightless powder that locks makeup in place for up to 16 hours." },
  { category: "SETTING_POWDER", name: "Fix Powder+", brand: "Charlotte Tilbury", shade: "Universal", colorHex: "#F3E6D6", price: 42, coverage: "Light", finish: "Luminous", skinType: "All skin types", desc: "A glow-boosting setting powder that blurs and brightens without flashback." },
];
