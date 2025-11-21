import { LandingButton } from '@/components/landing/LandingButton';
import { LandingStatCard } from '@/components/landing/LandingStatCard';
import { LandingFeatureCard } from '@/components/landing/LandingFeatureCard';
import { LandingTechBadge } from '@/components/landing/LandingTechBadge';
import { LandingShowcaseCard } from '@/components/landing/LandingShowcaseCard';
import { Github, Linkedin, ExternalLink } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-landing-bg text-landing-text scroll-smooth">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="max-w-6xl w-full mx-auto text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Track App: AI Racing Coach
            <br />
            <span className="text-landing-green">for Amateur Drivers</span>
          </h1>
          <p className="text-xl md:text-2xl text-landing-text/80 mb-10 max-w-4xl mx-auto leading-relaxed">
            Turn your track day data into actionable coaching insights. Built with Next.js, Supabase, and Claude AI—designed to help drivers improve faster.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <LandingButton href="https://trackapp-portal.vercel.app" variant="primary">
              View Live Demo
            </LandingButton>
            <LandingButton href="https://github.com/scottcollier10/track-app-mvp" variant="secondary">
              See the Code
            </LandingButton>
          </div>

          {/* Hero Image */}
          <figure className="border border-landing-border rounded-xl overflow-hidden shadow-2xl shadow-landing-green/10">
            <img
              src="https://placehold.co/1200x600/18181b/22c55e?text=Session+Detail+Screenshot"
              alt="Track App Session Detail Screenshot"
              className="w-full h-auto"
            />
          </figure>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 px-4 border-y border-landing-border bg-landing-cardBg/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <LandingStatCard label="Features" value="12+" />
            <LandingStatCard label="Tests" value="54" />
            <LandingStatCard label="Response Time" value="<2s" />
            <LandingStatCard label="Dependencies" value="0" />
          </div>
        </div>
      </section>

      {/* What It Does Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            What It Does
          </h2>
          <p className="text-landing-text/70 text-center mb-16 text-lg max-w-2xl mx-auto">
            Track App automates racing analytics and delivers AI-powered coaching insights tailored to your performance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <LandingFeatureCard
              icon="🎯"
              title="Automated Session Analysis"
              description="Every track session automatically scored for consistency, pace trends, and fatigue patterns."
              imageSrc="https://placehold.co/600x400/18181b/22c55e?text=Feature:+Session+Analysis"
              imageAlt="Automated Session Analysis Feature"
            />
            <LandingFeatureCard
              icon="🤖"
              title="AI Coaching Insights"
              description="Claude Sonnet 4.5 translates your data into prioritized recommendations."
              imageSrc="https://placehold.co/600x400/18181b/3b82f6?text=Feature:+AI+Coaching"
              imageAlt="AI Coaching Insights Feature"
            />
            <LandingFeatureCard
              icon="📈"
              title="Progress Tracking"
              description="See your improvement over time with session filtering and track-specific records."
              imageSrc="https://placehold.co/600x400/18181b/22c55e?text=Feature:+Progress+Tracking"
              imageAlt="Progress Tracking Feature"
            />
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-24 px-4 bg-landing-cardBg/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            Modern Stack, Scalable Foundation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-lg text-landing-text/80 leading-relaxed mb-6">
                Built with Next.js 14, Supabase (PostgreSQL), Anthropic Claude AI, deployed on Vercel Edge Network. TypeScript strict mode throughout.
              </p>
              <p className="text-landing-text/70 leading-relaxed">
                This architecture ensures fast performance, real-time data sync, and intelligent coaching at scale—all while maintaining type safety and developer experience.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <LandingTechBadge name="Next.js 14" />
              <LandingTechBadge name="Supabase" />
              <LandingTechBadge name="PostgreSQL" />
              <LandingTechBadge name="Anthropic AI" />
              <LandingTechBadge name="Vercel" />
              <LandingTechBadge name="TypeScript" />
              <LandingTechBadge name="Tailwind CSS" />
              <LandingTechBadge name="React 18" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Complete Feature Set
          </h2>
          <p className="text-landing-text/70 text-center mb-16 text-lg max-w-2xl mx-auto">
            Everything you need to analyze, improve, and track your racing performance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <LandingShowcaseCard
              title="Session Management"
              description="View all sessions, sortable and filterable by track, date, and performance metrics."
              imageSrc="https://placehold.co/500x300/18181b/fafafa?text=Session+Management"
              imageAlt="Session Management"
            />
            <LandingShowcaseCard
              title="Track Directory"
              description="Browse circuits with history and records, including best laps and session counts."
              imageSrc="https://placehold.co/500x300/18181b/fafafa?text=Track+Directory"
              imageAlt="Track Directory"
            />
            <LandingShowcaseCard
              title="Lap Analysis"
              description="Every lap with formatted times and deltas, showing pace progression throughout sessions."
              imageSrc="https://placehold.co/500x300/18181b/fafafa?text=Lap+Analysis"
              imageAlt="Lap Analysis"
            />
            <LandingShowcaseCard
              title="Driver Profile"
              description="Personal stats and achievements tracking your journey as a racing driver."
              imageSrc="https://placehold.co/500x300/18181b/fafafa?text=Driver+Profile"
              imageAlt="Driver Profile"
            />
            <LandingShowcaseCard
              title="Session Insights"
              description="Automated consistency and pace analysis with visual charts and trend indicators."
              imageSrc="https://placehold.co/500x300/18181b/fafafa?text=Session+Insights"
              imageAlt="Session Insights"
            />
            <LandingShowcaseCard
              title="AI Coaching"
              description="Prioritized recommendations for improvement based on your actual performance data."
              imageSrc="https://placehold.co/500x300/18181b/fafafa?text=AI+Coaching"
              imageAlt="AI Coaching"
            />
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-24 px-4 bg-landing-cardBg/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-12">
            See It In Action
          </h2>

          <figure className="relative border border-landing-border rounded-xl overflow-hidden shadow-2xl">
            <div className="relative aspect-video bg-landing-cardBg">
              <img
                src="https://placehold.co/800x450/18181b/22c55e?text=Product+Demo+Video"
                alt="Track App Product Demo Video"
                className="w-full h-full object-cover"
              />
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-landing-green/90 flex items-center justify-center hover:bg-landing-green transition-all cursor-pointer hover:scale-110">
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      {/* Open to Opportunities Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Open to Opportunities
          </h2>
          <p className="text-xl text-landing-text/80 mb-12 leading-relaxed max-w-2xl mx-auto">
            Built Track App to solve a real problem and prove platform thinking. Looking for partnerships, collaborations, feedback, and opportunities.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LandingButton href="https://www.linkedin.com/in/scottcollier10/" variant="primary">
              <Linkedin className="w-5 h-5 mr-2" />
              LinkedIn
            </LandingButton>
            <LandingButton href="https://github.com/scottcollier10/track-app-mvp" variant="secondary">
              <Github className="w-5 h-5 mr-2" />
              GitHub
            </LandingButton>
            <LandingButton href="https://trackapp-portal.vercel.app" variant="secondary">
              <ExternalLink className="w-5 h-5 mr-2" />
              Live Demo
            </LandingButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-landing-border bg-landing-cardBg/30 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-6 text-sm">
              <a
                href="https://trackapp-portal.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-landing-text/60 hover:text-landing-green transition-colors"
              >
                Live Demo
              </a>
              <a
                href="https://github.com/scottcollier10/track-app-mvp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-landing-text/60 hover:text-landing-green transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/scottcollier10/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-landing-text/60 hover:text-landing-green transition-colors"
              >
                LinkedIn
              </a>
            </div>

            <p className="text-landing-text/60 text-sm">
              © 2025 Scott Collier
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
