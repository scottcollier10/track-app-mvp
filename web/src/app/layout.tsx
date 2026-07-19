import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CoachViewProvider } from "@/context/coach-view";
import { CoachIdentityProvider } from "@/context/coach-identity";
import { getCurrentCoach } from "@/lib/auth/current-coach";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Track App - Coaching Dashboard",
  description: "Grassroots motorsport coaching dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const coach = await getCurrentCoach();
  const identity = coach ? { name: coach.name, email: coach.email } : null;

  return (
    <html lang="en">
      <body className={inter.className}>
        <CoachIdentityProvider coach={identity}>
          <CoachViewProvider>
            {children}
          </CoachViewProvider>
        </CoachIdentityProvider>
      </body>
    </html>
  );
}
