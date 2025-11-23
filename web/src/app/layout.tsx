import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CoachViewProvider } from "@/context/coach-view";
import Navigation from "@/components/layout/Navigation";

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
        <AuthProvider>
          <CoachViewProvider>
            <div className="min-h-screen flex flex-col bg-app">
              {/* Header */}
              <Navigation />

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
        </AuthProvider>
      </body>
    </html>
  );
}
