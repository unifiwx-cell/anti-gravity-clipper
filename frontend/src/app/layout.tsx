import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "Cliperg — AI Video Repurposing & Viral Shorts Studio",
  description: "Turn any YouTube video into 8–9 viral 9:16 shorts with AI hook detection, smart face-tracking cropping, ready-made title stuffs, and CapCut-style word-highlighted captions.",
  keywords:    "cliperg, viral clips, AI video editor, capcut captions, reels generator, youtube shorts generator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#090a10" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
