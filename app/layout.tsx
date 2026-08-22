import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mixtape Voting",
  description: "Votazioni live per la selezione della tracklist del mixtape",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen font-sans antialiased">
        <div className="bg-burst" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
