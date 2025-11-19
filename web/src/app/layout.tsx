import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import CoachViewToggle from "@/components/ui/CoachViewToggle";
import { CoachViewProvider } from "@/context/coach-view";
import { Flag } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Track App - Coaching Dashboard",
  description: "Grassroots motorsport coaching dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CoachViewProvider>
          <div className="min-h-screen flex flex-col bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-800/95 backdrop-blur-sm">
              <nav className="max-w-6xl mx-auto px-4 md:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center gap-8">
                    <Link href="/" className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                      <Flag className="w-5 h-5 text-blue-500" />
                      <span>Track App</span>
                    </Link>
                    <div className="hidden md:flex gap-6">
                      <Link
                        href="/sessions"
                        className="text-slate-400 hover:text-slate-100 transition-colors duration-200"
                      >
                        Sessions
                      </Link>
                      <Link
                        href="/tracks"
                        className="text-slate-400 hover:text-slate-100 transition-colors duration-200"
                      >
                        Tracks
                      </Link>
                      <Link
                        href="/profile"
                        className="text-slate-400 hover:text-slate-100 transition-colors duration-200"
                      >
                        Profile
                      </Link>
                    </div>
                  </div>
                  <div>
                    <CoachViewToggle />
                  </div>
                </div>
              </nav>
            </header>

            {/* Main */}
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 md:py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-700/50 mt-auto">
              <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
                <p className="text-center text-sm text-slate-500">
                  Track App MVP - Coaching Dashboard
                </p>
              </div>
            </footer>
          </div>
        </CoachViewProvider>
      </body>
    </html>
  );
}
