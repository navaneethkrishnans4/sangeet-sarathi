"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  School, 
  IndianRupee, 
  CheckCircle2, 
  AlertCircle,
  Search,
  X,
  Calendar,
  Hash
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  instrument?: string;
  expectedFee: number;
  orderNumber: string;
  sessionMonth: string;
  paymentStatus: string;
}

interface TeacherDetail {
  id: string;
  name: string;
  schoolName: string;
  totalPaid: number;
}

export default function LedgerDetailPage() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/ledger/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTeacher(data.teacher);
          setStudents(data.students || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredStudents = students.filter(student => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      student.name?.toLowerCase().includes(q) ||
      student.orderNumber?.toLowerCase().includes(q) ||
      student.sessionMonth?.toLowerCase().includes(q) ||
      student.subject?.toLowerCase().includes(q) ||
      student.grade?.toLowerCase().includes(q) ||
      student.instrument?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/ledger" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Teachers Ledger
        </Link>
        
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading teacher details...</div>
        ) : !teacher ? (
          <div className="text-center py-20 text-rose-500">Teacher not found.</div>
        ) : (
          <>
            {/* Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
              <div>
                <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                  <User className="text-blue-400 w-8 h-8" />
                  {teacher.name}
                </h1>
                <div className="flex items-center gap-2 mt-3 text-slate-400">
                  <School className="w-4 h-4 text-slate-500" />
                  <span>{teacher.schoolName}</span>
                </div>
              </div>
              
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[200px]">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Total Reconciled Amount</div>
                <div className="text-3xl font-mono text-emerald-400 font-bold flex items-center">
                  <IndianRupee className="w-6 h-6 mr-1 opacity-80" />
                  {formatCurrency(teacher.totalPaid).replace('₹', '')}
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50">
                <div>
                  <h2 className="text-xl font-bold text-white">Enrolled Students ({students.length})</h2>
                  <p className="text-xs text-slate-400 mt-1">Full breakdown of students, orders, session months, and payment status.</p>
                </div>

                {/* Search Bar for Students */}
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search student, order #, month..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <th className="p-4 font-medium">Student Name</th>
                      <th className="p-4 font-medium">Subject & Grade</th>
                      <th className="p-4 font-medium">Order Number</th>
                      <th className="p-4 font-medium text-center">Month</th>
                      <th className="p-4 font-medium text-right">Fee Amount</th>
                      <th className="p-4 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredStudents.map((student) => {
                      const isPaid = student.paymentStatus === "Reconciled";
                      return (
                        <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-slate-200 font-semibold">{student.name}</td>
                          <td className="p-4">
                            <div className="text-sm text-slate-300 font-medium">{student.subject}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{student.grade}</span>
                              {student.instrument && <span>• {student.instrument}</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-blue-300 bg-blue-950/50 px-2.5 py-1 rounded-md border border-blue-800/40">
                              <Hash className="w-3 h-3 text-blue-400 opacity-70" />
                              {student.orderNumber || "-"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-300 font-medium bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-800/40">
                              <Calendar className="w-3 h-3 text-amber-400 opacity-80" />
                              {student.sessionMonth || "-"}
                            </span>
                          </td>
                          <td className={`p-4 text-right font-mono font-bold ${isPaid ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatCurrency(student.expectedFee)}
                          </td>
                          <td className="p-4 text-center">
                            {isPaid ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Paid
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Unpaid
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          {searchQuery ? `No students found matching "${searchQuery}".` : "No candidates found for this teacher."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
