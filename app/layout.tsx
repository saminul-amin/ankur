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
};

// Applied before first paint so a stored appearance choice never flashes the
// opposite theme. It only reads one own-origin key and sets one data attribute.
const themeBootstrap = `try{var t=localStorage.getItem("ankur.theme.v1");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${manrope.variable} ${notoBengali.variable}`} lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body>{children}</body>
    </html>
  );
}
