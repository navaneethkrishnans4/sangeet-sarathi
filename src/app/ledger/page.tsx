"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, ChevronRight, School, ArrowLeft, Search, X } from "lucide-react";

interface LedgerItem {
  id: string;
  teacherName: string;
  academyName: string;
  candidateCount: number;
  amountPaid: number;
  studentNames?: string[];
}

export default function LedgerPage() {
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredLedger = ledger.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchTeacher = item.teacherName?.toLowerCase().includes(q);
    const matchAcademy = item.academyName?.toLowerCase().includes(q);
    const matchStudent = item.studentNames?.some(name => name.toLowerCase().includes(q));
    return matchTeacher || matchAcademy || matchStudent;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <FileText className="text-blue-400" />
              Teachers Ledger
            </h1>
            <p className="text-slate-400 mt-2">Overview of all teachers, their enrolled candidates, and total amounts paid.</p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by student, academy, or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading ledger data...</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Search result count strip */}
            {searchQuery.trim() && (
              <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Showing <strong className="text-blue-400">{filteredLedger.length}</strong> matching of {ledger.length} teachers
                </span>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-white underline text-xs"
                >
                  Reset filter
                </button>
              </div>
            )}

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
                {filteredLedger.map((item) => {
                  const q = searchQuery.toLowerCase().trim();
                  const matchingStudents = q && item.studentNames 
                    ? item.studentNames.filter(name => name.toLowerCase().includes(q))
                    : [];

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 text-slate-200 font-medium">
                        <Link href={`/ledger/${item.id}`} className="hover:text-blue-400 transition-colors">
                          {item.teacherName}
                        </Link>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-slate-400">
                          <School className="w-4 h-4 mr-2 opacity-50 shrink-0" />
                          <span>{item.academyName}</span>
                        </div>
                        {matchingStudents.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                            <span className="text-[11px] text-blue-400/80 font-medium">Matched student:</span>
                            {matchingStudents.slice(0, 3).map((st, i) => (
                              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                {st}
                              </span>
                            ))}
                            {matchingStudents.length > 3 && (
                              <span className="text-[10px] text-slate-500">+{matchingStudents.length - 3} more</span>
                            )}
                          </div>
                        )}
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
                        <Link href={`/ledger/${item.id}`} className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      {searchQuery ? `No teachers or students found matching "${searchQuery}".` : "No teachers found."}
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
