import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import CoachViewToggle from "@/components/ui/CoachViewToggle";
import { CoachViewProvider } from "@/context/coach-view";

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
          <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950">
              <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center gap-8">
                    <Link href="/" className="text-xl font-bold">
                      🏁 Track App
                    </Link>
                    <div className="hidden md:flex gap-6">
                      <Link
                        href="/sessions"
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        Sessions
                      </Link>
                      <Link
                        href="/tracks"
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        Tracks
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
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-gray-800 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <p className="text-center text-sm text-gray-500">
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
