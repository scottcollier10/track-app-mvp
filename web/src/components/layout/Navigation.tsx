"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCoachView } from "@/context/coach-view";
import { useAuth } from "@/components/auth/AuthProvider";
import { Flag, LayoutDashboard, Menu, X, User, LogOut } from "lucide-react";
import CoachViewToggle from "@/components/ui/CoachViewToggle";

export default function Navigation() {
  const pathname = usePathname();
  const { coachView } = useCoachView();
  const { user, signOut, loading } = useAuth();
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
            {user && <CoachViewToggle />}

            {/* Auth Section - Desktop */}
            {!loading && (
              <>
                {user ? (
                  <div className="hidden md:flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <User className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-3">
                    <Link
                      href="/login"
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </>
            )}

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
              {user ? (
                <>
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
                  <div className="pt-4 border-t border-subtle">
                    <div className="flex items-center gap-2 text-sm text-muted mb-3">
                      <User className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        signOut();
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-muted hover:text-primary transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-center"
                    onClick={closeMobileMenu}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
