import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700"] });
const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%232de2e6'/%3E%3Cstop offset='100%25' stop-color='%23ff3ea5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='22' fill='%2307060d'/%3E%3Cpath d='M50 12 L61 42 L91 50 L61 58 L50 88 L39 58 L9 50 L39 42 Z' fill='url(%23g)'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Mixtape Voting",
  description: "Votazioni live per la selezione della tracklist del mixtape",
  icons: { icon: FAVICON },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <div className="cover-backdrop" aria-hidden="true">
          <img src="/cover.jpg" alt="" />
        </div>
        {children}
      </body>
    </html>
  );
}
