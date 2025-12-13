"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { UploadCloud, Menu, X } from "lucide-react";
import { useCoachView } from "@/context/coach-view";
import CoachViewToggle from "@/components/ui/CoachViewToggle";

export function TrackAppHeader() {
  const { coachView } = useCoachView();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-900/40 bg-slate-950/30 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        {/* Logo + wordmark */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center">
            <Image
              src="/images/trackapp-logo.png"
              alt="Track App logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Track App
            </span>
            <span className="text-[11px] text-slate-500">
              Racing Analytics &amp; Coaching Platform
            </span>
          </div>
        </Link>

        {/* Center nav - Desktop */}
        <nav className="hidden items-center gap-6 text-xs font-medium text-slate-300 md:flex">
          <Link href="/sessions" className="hover:text-slate-50">
            Sessions
          </Link>
          <Link href="/tracks" className="hover:text-slate-50">
            Tracks
          </Link>
          <Link href="/profile" className="hover:text-slate-50">
            Profile
          </Link>
          {coachView && (
            <Link href="/coach" className="hover:text-slate-50">
              Coach Dashboard
            </Link>
          )}
          {coachView && (
            <Link
              href="/import"
              className="flex items-center gap-1.5 hover:text-slate-50"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Import CSV
            </Link>
          )}
        </nav>

        {/* Right-side CTAs */}
        <div className="flex items-center gap-4">
          <CoachViewToggle />

          {/* Hamburger menu button - Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-slate-50"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-900/40 bg-slate-950/95 backdrop-blur-xl">
          <nav className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-4 text-sm font-medium text-slate-300">
            <Link
              href="/sessions"
              className="hover:text-slate-50 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sessions
            </Link>
            <Link
              href="/tracks"
              className="hover:text-slate-50 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Tracks
            </Link>
            <Link
              href="/profile"
              className="hover:text-slate-50 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
            {coachView && (
              <Link
                href="/coach"
                className="hover:text-slate-50 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Coach Dashboard
              </Link>
            )}
            {coachView && (
              <Link
                href="/import"
                className="flex items-center gap-2 hover:text-slate-50 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <UploadCloud className="h-4 w-4" />
                Import CSV
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
