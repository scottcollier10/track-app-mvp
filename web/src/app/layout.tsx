import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
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
          {children}
        </CoachViewProvider>
      </body>
    </html>
  );
}
