"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCoachView } from "@/context/coach-view";
import { Flag, LayoutDashboard, Menu, X } from "lucide-react";
import CoachViewToggle from "@/components/ui/CoachViewToggle";

export default function Navigation() {
  const pathname = usePathname();
  const { coachView } = useCoachView();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/coach") {
      return pathname?.startsWith("/coach");
    }
    return pathname === path;
  };

  const linkClass = (path: string) => {
    return isActive(path)
      ? "text-primary font-medium transition-colors"
      : "text-muted hover:text-primary transition-colors";
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-surface">
      <nav className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-semibold text-primary flex items-center gap-2">
              <Flag className="w-5 h-5 text-accent-primary" />
              <span>Track App</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex gap-6">
              <Link
                href="/sessions"
                className={linkClass("/sessions")}
              >
                Sessions
              </Link>
              <Link
                href="/tracks"
                className={linkClass("/tracks")}
              >
                Tracks
              </Link>
              <Link
                href="/profile"
                className={linkClass("/profile")}
              >
                Profile
              </Link>
              {coachView && (
                <Link
                  href="/coach"
                  className={`${linkClass("/coach")} flex items-center gap-1.5`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Coach Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <CoachViewToggle />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-muted hover:text-primary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-subtle py-4">
            <div className="flex flex-col space-y-4">
              <Link
                href="/sessions"
                className={linkClass("/sessions")}
                onClick={closeMobileMenu}
              >
                Sessions
              </Link>
              <Link
                href="/tracks"
                className={linkClass("/tracks")}
                onClick={closeMobileMenu}
              >
                Tracks
              </Link>
              <Link
                href="/profile"
                className={linkClass("/profile")}
                onClick={closeMobileMenu}
              >
                Profile
              </Link>
              {coachView && (
                <Link
                  href="/coach"
                  className={`${linkClass("/coach")} flex items-center gap-1.5`}
                  onClick={closeMobileMenu}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Coach Dashboard
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
