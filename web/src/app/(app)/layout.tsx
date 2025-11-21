import Link from "next/link";
import CoachViewToggle from "@/components/ui/CoachViewToggle";
import { CoachViewProvider } from "@/context/coach-view";
import { Flag } from "lucide-react";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CoachViewProvider>
      <div className="min-h-screen flex flex-col bg-app">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-subtle bg-surface">
          <nav className="max-w-6xl mx-auto px-4 md:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-8">
                <Link href="/dashboard" className="text-xl font-semibold text-primary flex items-center gap-2">
                  <Flag className="w-5 h-5 text-accent-primary" />
                  <span>Track App</span>
                </Link>
                <div className="hidden md:flex gap-6">
                  <Link
                    href="/sessions"
                    className="text-muted hover:text-primary transition-colors"
                  >
                    Sessions
                  </Link>
                  <Link
                    href="/tracks"
                    className="text-muted hover:text-primary transition-colors"
                  >
                    Tracks
                  </Link>
                  <Link
                    href="/profile"
                    className="text-muted hover:text-primary transition-colors"
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
        <footer className="border-t border-subtle mt-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
            <p className="text-center text-sm text-text-subtle">
              Track App MVP - Coaching Dashboard
            </p>
          </div>
        </footer>
      </div>
    </CoachViewProvider>
  );
}
