import type { Metadata } from "next";
import "./trinity.css";

export const metadata: Metadata = {
  title: "Trinity Master Dashboard | Sangeet Sarathi",
  description: "Central hub for Trinity College London exam enrolments, reconciliation, and ledger.",
};

export default function TrinityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans antialiased">
      {children}
    </div>
  );
}
