import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./trinity.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trinity Master Dashboard",
  description: "Central hub for enrolments, reconciliation, and financial insights.",
};

export default function TrinityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} font-sans trinity-scope min-h-screen bg-slate-900 text-white antialiased`}>
      {children}
    </div>
  );
}
