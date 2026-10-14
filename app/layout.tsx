import type { Metadata } from "next";
import { Manrope, Noto_Sans_Bengali } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ankur — Grow knowledge from sources you trust",
  description: "A source-grounded learning studio that turns confirmed Bengali and English material into transparent practice.",
  metadataBase: new URL("https://ankur-gamma.vercel.app"),
  openGraph: {
    type: "website",
    url: "/",
    title: "Ankur — Grow knowledge from sources you trust",
    description: "A source-grounded learning studio that turns confirmed Bengali and English material into transparent practice.",
    images: [{ url: "/og-image.png", width: 1200, height: 627, alt: "Ankur — source-grounded adaptive learning" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html className={`${manrope.variable} ${notoBengali.variable}`} lang="en"><body>{children}</body></html>;
}
