# Track App Landing Page

A professional, modern landing page for Track App built with Next.js 14, TypeScript, and Tailwind CSS.

## Overview

The landing page showcases Track App as an AI-powered racing analytics platform for amateur drivers. It features a dark-mode design with smooth animations, responsive layouts, and comprehensive sections highlighting features, tech stack, and opportunities.

## Quick Start

### Local Development

1. **Navigate to the web directory:**
   ```bash
   cd web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000) to see the landing page.

### Build for Production

```bash
npm run build
npm start
```

## Deployment to Vercel

### Option 1: Deploy via GitHub

1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js and configure build settings
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy from the web directory:**
   ```bash
   cd web
   vercel
   ```

3. **Follow the prompts to deploy**

## Project Structure

### Pages & Routes

```
web/src/app/
├── page.tsx                    # Landing page (root route)
├── layout.tsx                  # Root layout with SEO meta tags
├── globals.css                 # Global styles
└── (app)/                      # Route group for app pages
    ├── layout.tsx              # App layout with navigation header
    ├── dashboard/              # Dashboard page
    ├── sessions/               # Sessions pages
    ├── tracks/                 # Tracks pages
    ├── profile/                # Profile page
    └── coach/                  # Coach page
```

### Landing Page Components

All landing page components are located in `web/src/components/landing/`:

```
web/src/components/landing/
├── LandingButton.tsx           # Primary & secondary button variants
├── LandingStatCard.tsx         # Stats display cards
├── LandingFeatureCard.tsx      # Main feature cards with icons
├── LandingShowcaseCard.tsx     # Feature showcase grid cards
└── LandingTechBadge.tsx        # Technology badge pills
```

#### Component Descriptions

**LandingButton**
- Variants: `primary` (green) and `secondary` (outline)
- Supports internal and external links
- Hover animations and transitions
- Usage: CTAs, navigation links

**LandingStatCard**
- Displays metrics in a clean card format
- Hover effects with color transitions
- Used in the stats bar section

**LandingFeatureCard**
- Icon, title, description, and optional image
- Hover scale animation
- Used for the main "What It Does" section

**LandingShowcaseCard**
- Image-first layout with title and description
- Used for the 6-item feature showcase grid
- Consistent hover states

**LandingTechBadge**
- Technology stack display badges
- Blue accent color with transparency
- Used in the tech stack section

## Landing Page Sections

The landing page includes the following sections (in order):

1. **Hero Section** - Full viewport height with headline, subheadline, CTAs, and hero image
2. **Stats Bar** - 4 key metrics in a horizontal layout
3. **What It Does** - 3 main feature cards with icons and images
4. **Tech Stack** - Technology badges and description
5. **Features Showcase** - 2x3 grid of 6 feature cards
6. **Video Demo** - Video placeholder with play button overlay
7. **Open to Opportunities** - Call-to-action section with social links
8. **Footer** - Links and copyright information

## Design System

### Colors (Tailwind Config)

The landing page uses custom colors defined in `tailwind.config.ts`:

```typescript
landing: {
  bg: "#0a0a0a",           // Main background (very dark)
  text: "#fafafa",          // Primary text (off-white)
  green: "#22c55e",         // Accent/CTA color
  blue: "#3b82f6",          // Secondary accent
  border: "#27272a",        // Border color
  cardBg: "#18181b",        // Card backgrounds
}
```

### Typography

- Font: Inter (Google Fonts)
- Headings: Bold, responsive sizes (text-4xl to text-7xl)
- Body: text-lg with relaxed line-height
- Monospace: Default for code/technical content

### Responsive Breakpoints

- Mobile: < 768px (1 column layouts)
- Tablet: 768px - 1024px (2 column layouts)
- Desktop: > 1024px (3 column layouts for grids)

## Placeholder Images to Replace

All images currently use [placehold.co](https://placehold.co) placeholders. Replace these with actual screenshots and assets:

### Hero Section
- **Location:** `web/src/app/page.tsx` (line ~36)
- **Current:** `https://placehold.co/1200x600/18181b/22c55e?text=Session+Detail+Screenshot`
- **Size:** 1200x600px
- **Recommended:** Screenshot of the session detail page

### What It Does Section (3 images)

1. **Automated Session Analysis**
   - **Location:** Line ~71
   - **Current:** `https://placehold.co/600x400/18181b/22c55e?text=Feature:+Session+Analysis`
   - **Size:** 600x400px
   - **Recommended:** Screenshot showing session analysis metrics

2. **AI Coaching Insights**
   - **Location:** Line ~78
   - **Current:** `https://placehold.co/600x400/18181b/3b82f6?text=Feature:+AI+Coaching`
   - **Size:** 600x400px
   - **Recommended:** Screenshot of AI coaching recommendations

3. **Progress Tracking**
   - **Location:** Line ~85
   - **Current:** `https://placehold.co/600x400/18181b/22c55e?text=Feature:+Progress+Tracking`
   - **Size:** 600x400px
   - **Recommended:** Screenshot showing progress charts/trends

### Features Showcase Section (6 images)

All located in `web/src/app/page.tsx` around lines 137-168:

1. **Session Management** - 500x300px
2. **Track Directory** - 500x300px
3. **Lap Analysis** - 500x300px
4. **Driver Profile** - 500x300px
5. **Session Insights** - 500x300px
6. **AI Coaching** - 500x300px

### Video Section
- **Location:** Line ~184
- **Current:** `https://placehold.co/800x450/18181b/22c55e?text=Product+Demo+Video`
- **Size:** 800x450px (16:9 aspect ratio)
- **Recommended:** Video thumbnail or replace entire section with actual video embed

### SEO/Meta Images

Located in `web/src/app/layout.tsx` (lines 18-31):

- **Open Graph Image:** 1200x630px
- **Twitter Card Image:** 1200x630px
- **Recommended:** Professional social sharing image with Track App branding

## Customization Guide

### Changing Colors

Edit `web/tailwind.config.ts` and modify the `landing` color object:

```typescript
landing: {
  bg: "#0a0a0a",     // Your background color
  text: "#fafafa",   // Your text color
  green: "#22c55e",  // Your accent color
  blue: "#3b82f6",   // Your secondary color
  border: "#27272a", // Your border color
  cardBg: "#18181b", // Your card background
}
```

### Updating Content

All content is in `web/src/app/page.tsx`. Edit text directly in the JSX:

- **Headlines:** Search for `<h1>` and `<h2>` tags
- **Descriptions:** Update `<p>` tag content
- **CTAs:** Modify button text and links
- **Stats:** Update values in `<LandingStatCard>` components

### Adding/Removing Sections

Sections are wrapped in `<section>` tags. You can:
- Reorder sections by moving entire `<section>` blocks
- Remove sections by deleting the corresponding `<section>` block
- Duplicate sections as templates for new content

### Modifying SEO Metadata

Edit `web/src/app/layout.tsx` to update:
- Page title
- Meta description
- Open Graph tags
- Twitter card data
- Keywords
- Favicon

## Testing Checklist

Before deploying, test the following:

- [ ] All links work correctly (external links open in new tabs)
- [ ] Responsive design looks good on mobile, tablet, and desktop
- [ ] Images load properly
- [ ] Hover effects work on buttons and cards
- [ ] Smooth scrolling works
- [ ] SEO meta tags are correct (check with browser dev tools)
- [ ] Build completes without errors (`npm run build`)
- [ ] Production build runs correctly (`npm start`)

## Performance Optimization

The landing page is optimized for performance:

1. **Image Loading:**
   - Use Next.js `Image` component when replacing placeholders
   - Optimize images before uploading (use WebP format when possible)
   - Recommended tool: [squoosh.app](https://squoosh.app)

2. **Code Splitting:**
   - Next.js automatically code-splits by route
   - Landing page loads independently from app pages

3. **Fonts:**
   - Inter font is optimized via `next/font/google`
   - Automatic subsetting for faster loading

4. **CSS:**
   - Tailwind CSS purges unused styles in production
   - Minimal custom CSS

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run build
   ```

2. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Styling Issues

If styles don't appear:

1. Ensure Tailwind is configured correctly in `tailwind.config.ts`
2. Check that `globals.css` imports Tailwind directives
3. Restart the dev server after config changes

### Route Group Issues

If pages aren't loading:

1. Verify the `(app)` directory has proper parentheses
2. Check that all pages have `page.tsx` files
3. Ensure layouts are named `layout.tsx`

## Additional Resources

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Next.js App Router Guide](https://nextjs.org/docs/app)

## Support

For questions or issues:
- GitHub: [scottcollier10/track-app-mvp](https://github.com/scottcollier10/track-app-mvp)
- LinkedIn: [Scott Collier](https://www.linkedin.com/in/scottcollier10/)

## License

See LICENSE file in the root directory.

---

Built with Next.js 14, TypeScript, and Tailwind CSS
© 2025 Scott Collier
