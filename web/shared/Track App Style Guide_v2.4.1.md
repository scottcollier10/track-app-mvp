# Track App Style Guide

## Typography

- **Base font:** Tailwind `font-sans` (system / Inter-style)
- **Page title:**
    - `text-3xl md:text-4xl font-semibold tracking-tight text-slate-50`
- **Section headings (labels like “Program overview”, “Drivers overview”):**
    - `text-xs font-semibold uppercase tracking-[0.18em]`
    - Colors: `text-amber-400`, `text-slate-400`, `text-emerald-300`, `text-rose-200`
- **Body copy:**
    - `text-sm text-slate-300` (paragraphs)
    - Tables: `text-[13px] text-slate-200`
- **Tiny helper/secondary text:**
    - `text-[11px] text-slate-400/500` (helper lines, captions, badges)
- **Numeric / lap times:**
    - `font-mono text-[13px] text-emerald-300` (best laps)
    - `font-mono text-[13px] text-slate-300` (avg best, consistency)

---

## 2. Color System (Tailwind tokens)

**Backgrounds**

- App shell: `bg-slate-850` (custom deep blue-slate)
- Hero burst overlay: heroBurst image +
    - `bg-slate-950/20` overlay to keep text legible

**Surfaces**

- Primary cards / table:
    - `bg-slate-900/80`, `bg-slate-950/80`
    - Borders: `border-slate-800/80`
- Top-5 gradient card:
    - `bg-gradient-to-b from-emerald-500/12 via-emerald-500/4 to-slate-950/80`
    - Border: `border-emerald-500/40`
- Bottom-5 gradient card:
    - `bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80`
    - Border: `border-rose-500/45`
- Inner rows inside those cards: `bg-slate-900/60` (top-5), `bg-slate-900/70` (bottom-5)

**Text**

- Primary: `text-slate-50` (titles), `text-slate-200/300` (body)
- Muted: `text-slate-400/500` (meta info, captions)
- Highlight numeric: `text-emerald-300` (positive performance), `text-amber-400` (section label)

**Accent / Status**

- Success / “good”: `emerald-400`, `emerald-500`, `emerald-300`
- Warning / “pay attention”: `rose-400`, `rose-500`
- Section label accent: `amber-400`
- Progress bar fill: `bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300`

---

## 3. Components

**Metric Card**

- Container:
    - `rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-4`
    - Shadow: `shadow-[0_18px_45px_rgba(15,23,42,0.75)]`
    - `backdrop-blur` for glassy feel
- Content: label (tiny uppercase), big value, helper line.

**Top / Bottom 5 Cards**

- Layout:
    - `rounded-2xl px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]`
    - Grid: `lg:grid-cols-2` section above the table.
- Header: left text block + right pill badge:
    - `rounded-full border ... bg-... px-3 py-1 text-[11px]`
- Rows:
    - Flex: `flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 px-3 py-2`

**Behavior Bar**

- Track: `h-2 w-28 rounded-full bg-slate-700/80 relative overflow-hidden`
- Fill: `bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300`
- Edge ring: `ring-1 ring-slate-900/80`
- Value label: `text-xs tabular-nums text-slate-300`

**Drivers Table**

- Wrapper:
    - `overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_50px_rgba(15,23,42,0.9)]`
- Header row: tiny uppercase, `tracking-[0.18em] text-slate-400`
- Spacing:
    - `border-separate border-spacing-y-1`
    - `px-4 py-2` for cells
- Responsive columns: hide less-critical columns with `hidden md:table-cell` / `hidden lg:table-cell`.

---

## 4. Layout & Spacing

- Page container:
    - `max-w-6xl mx-auto px-4 pt-10 pb-16 flex flex-col gap-8`
- Vertical rhythm: 8px multiples via `gap-4`, `gap-8`, `py-4`, etc.
- Radii: `rounded-2xl` for all major cards, `rounded-xl` for internal rows, `rounded-full` for pills and progress bars.
- Everything sits on top of a **fixed hero burst** background using:
    - `pointer-events-none fixed inset-0 -z-10` + `<Image ... />`

---

## Header Code

For reference

Here’s the header/menu bar pulled straight out of the landing page, isolated so you can drop it into any page as `<TrackAppHeader />` (logo + glass/blur + nav + CTAs). 
page

```tsx
// components/TrackAppHeader.tsx
"use client";

import Image from "next/image";
import trackLogo from "@/public/images/trackapp-logo.png";

export function TrackAppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-900/40 bg-slate-950/30 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center">
            <Imagesrc={trackLogo}
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
        </div>

        {/* Center nav */}
        <nav className="hidden items-center gap-6 text-xs font-medium text-slate-300 md:flex">
          <a href="#features" className="hover:text-slate-50">
            Features
          </a>
          <a href="#stack" className="hover:text-slate-50">
            Tech Stack
          </a>
          <a href="#numbers" className="hover:text-slate-50">
            Performance
          </a>
          <a href="#story" className="hover:text-slate-50">
            Story
          </a>
        </nav>

        {/* Right-side CTAs */}
        <div className="flex items-center gap-2">
          <ahref="https://trackapp-portal.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-600/70 hover:text-white md:inline-flex"
          >
            Live demo
          </a>
          <ahref="https://github.com/scottcollier10/track-app-mvp"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-lg shadow-slate-900/40 hover:bg-white"
          >
            See the code
          </a>
        </div>
      </div>
    </header>
  );
}

```

Then in any `page.tsx`:

```tsx
import { TrackAppHeader } from "@/components/TrackAppHeader";

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <TrackAppHeader />
      {/* rest of page */}
    </div>
  );
}

```

Only thing you might need to tweak is the `trackLogo` import path if your folder structure is different.

---

## View Button in Tables

Here’s a drop-in React/Tailwind version that matches that look, with a primary (blue) and subtle (grey) style.

```tsx
// components/ViewButton.tsx
type ViewButtonProps = {
  variant?: "primary" | "subtle";
};

export function ViewButton({ variant = "primary" }: ViewButtonProps) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border text-[11px] " +
    "transition-colors transition-transform duration-150 ease-out " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  const styles =
    variant === "primary"
      ? [
          "border-sky-400/90 text-sky-50",
          "bg-slate-900/70 shadow-[0_0_0_1px_rgba(15,23,42,0.8),0_10px_25px_rgba(8,47,73,0.65)]",
          "hover:bg-sky-500/15 hover:border-sky-300 hover:text-sky-50",
          "active:scale-95",
        ].join(" ")
      : [
          "border-slate-600/70 text-slate-200",
          "bg-slate-950/60 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]",
          "hover:bg-slate-800/80 hover:border-slate-400 hover:text-slate-50",
          "active:scale-95",
        ].join(" ");

  return (
    <button type="button" className={`${base} ${styles}`}>
      <span className="translate-x-px">→</span>
    </button>
  );
}
```

**Usage in the table action column:**

```tsx
<td className="whitespace-nowrap px-4 py-2 text-right align-middle">
  <ViewButton variant="primary" />
</td>
```

For the dimmer rows, just switch to:

```tsx
<ViewButton variant="subtle" />
```

---

Behavior bars - Code for Reference if needed

Here’s the exact Behavior bar implementation and its usages pulled cleanly out of your current `coach/page.tsx`. 
page

---

### 1. BehaviorBar component

```tsx
function BehaviorBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const width = `${clamped}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 overflow-hidden rounded-full bg-slate-700/80">
        {/* main fill */}
        <divclassName="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300"
          style={{ width }}
        />
        {/* subtle ring to sharpen edges */}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-slate-900/80" />
      </div>
      <span className="text-xs tabular-nums text-slate-300">{value}%</span>
    </div>
  );
}
```

If you want to reuse this elsewhere, you can drop this function into any file and import/use it like any other React component.

---

### 2. Usage in the **Top 5 Improving** card

```tsx
function TopFiveCard({ drivers }: { drivers: DriverRow[] }) {
  return (
    <div className="h-full rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/12 via-emerald-500/4 to-slate-950/80 px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      {/* header omitted for brevity */}

      <div className="space-y-2">
        {drivers.map((d) => (
          <divkey={d.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-50">
                {d.name}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {d.track} • {d.bestLap}
              </p>
            </div>

            {/* behavior bar */}
            <BehaviorBar value={d.behavior} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 3. Usage in the **Bottom 5 to Watch** card

```tsx
function BottomFiveCard({ drivers }: { drivers: DriverRow[] }) {
  return (
    <div className="h-full rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      {/* header omitted for brevity */}

      <div className="space-y-2">
        {drivers.map((d) => (
          <divkey={d.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-50">
                {d.name}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {d.track} • {d.bestLap}
              </p>
            </div>

            {/* behavior bar */}
            <BehaviorBar value={d.behavior} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Usage inside the **Drivers table** rows

```tsx
function DriversTable({ drivers }: { drivers: DriverRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
      {/* header omitted */}

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-1 px-2 py-2 text-sm">
          {/* thead omitted */}
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="align-middle">
                {/* other cells omitted */}

                <Td>
                  {/* behavior bar cell */}
                  <BehaviorBar value={d.behavior} />
                </Td>

                {/* remaining cells */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-800/80 px-4 py-2 text-[11px] text-slate-500">
        Showing {drivers.length} of 28 drivers · demo slice
      </div>
    </div>
  );
}
```

---

### Style guide delta vs earlier version

Relative to the earlier style guide you asked for, the main **new** stylistic pieces introduced by the behavior bars are:

- **Bar background**: `bg-slate-700/80`
- **Bar gradient fill**: `bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300`
- **Edge ring**: `ring-1 ring-slate-900/80`
- **Text**: `text-xs tabular-nums text-slate-300`