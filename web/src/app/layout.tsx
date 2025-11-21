import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Track App - AI Racing Coach for Amateur Drivers",
  description: "AI-powered racing analytics platform. Automated session analysis, coaching insights, and progress tracking for track-day drivers.",
  keywords: ["racing", "motorsport", "AI coaching", "track day", "lap times", "racing analytics", "driver coaching"],
  authors: [{ name: "Scott Collier" }],
  openGraph: {
    title: "Track App - AI Racing Coach for Amateur Drivers",
    description: "Turn your track day data into actionable coaching insights. Built with Next.js, Supabase, and Claude AI.",
    url: "https://trackapp-portal.vercel.app",
    siteName: "Track App",
    type: "website",
    images: [
      {
        url: "https://placehold.co/1200x630/0a0a0a/22c55e?text=Track+App",
        width: 1200,
        height: 630,
        alt: "Track App - AI Racing Coach",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Track App - AI Racing Coach for Amateur Drivers",
    description: "AI-powered racing analytics platform for track-day drivers",
    images: ["https://placehold.co/1200x630/0a0a0a/22c55e?text=Track+App"],
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏁</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
