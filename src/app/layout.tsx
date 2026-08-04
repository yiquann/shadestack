import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Shadestack — Virtual Beauty Try-On",
  description: "Real-time AR virtual makeup try-on",
};

/**
 * Next's default viewport tag is `width=device-width, initial-scale=1` with no
 * `viewport-fit`, and iOS resolves every safe-area-inset environment variable
 * to 0 unless `viewport-fit=cover` is set. That silently made two things inert
 * on device: the trailing safe-area term in `--nav-h`, and the matching
 * bottom-padding utility on BottomNav. Both were written for a non-zero inset,
 * so the tab bar never reserved room for the home indicator on a real iPhone —
 * and because desktop DevTools reports the inset as 0 too, phone-size emulation
 * looks identical to a correct render. Declaring it here turns that code on.
 *
 * Careful with the wording above: Tailwind v4 scans this file's raw text for
 * class-like tokens, so spelling a bracketed arbitrary-value utility here
 * generates it for real. An unresolvable one fails the CSS parse app-wide.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
