import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "Anti-Gravity Clipper — AI Viral Shorts Engine",
  description: "Turn any YouTube video into 8–9 viral 9:16 shorts with AI hook detection, speaker-centred cropping, and CapCut-style word-highlighted captions.",
  keywords:    "youtube shorts, viral clips, AI video editor, capcut captions, reels generator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#020206" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
