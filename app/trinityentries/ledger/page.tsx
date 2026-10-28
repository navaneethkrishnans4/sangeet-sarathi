"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, ChevronRight, School, ArrowLeft } from "lucide-react";

interface LedgerItem {
  id: string;
  teacherName: string;
  academyName: string;
  candidateCount: number;
  amountPaid: number;
}

export default function LedgerPage() {
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ledger")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLedger(data.ledger);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/trinityentries" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <FileText className="text-blue-400" />
            Teachers Ledger
          </h1>
          <p className="text-slate-400 mt-2">Overview of all teachers, their enrolled candidates, and total amounts paid.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading ledger data...</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th className="p-4 font-medium">Teacher Name</th>
                  <th className="p-4 font-medium">Academy</th>
                  <th className="p-4 font-medium text-center">Candidates</th>
                  <th className="p-4 font-medium text-right">Amount Paid</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {ledger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-4 text-slate-200 font-medium">{item.teacherName}</td>
                    <td className="p-4">
                      <div className="flex items-center text-sm text-slate-400">
                        <School className="w-4 h-4 mr-2 opacity-50" />
                        {item.academyName}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center justify-center bg-slate-800 text-slate-300 rounded-full px-3 py-1 text-xs font-bold">
                        <Users className="w-3 h-3 mr-1.5 opacity-50" />
                        {item.candidateCount}
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono text-emerald-400 font-medium">
                      {formatCurrency(item.amountPaid)}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/trinityentries/ledger/${item.id}`} className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
