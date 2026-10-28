import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./trinity.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trinity Master Dashboard | Sangeet Sarathi",
  description: "Central hub for candidate enrolments, reconciliation, and financial insights.",
};

export default function TrinityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} ${inter.variable} trinity-scope min-h-screen bg-slate-900 text-white font-sans antialiased`}>
      {children}
    </div>
  );
}
