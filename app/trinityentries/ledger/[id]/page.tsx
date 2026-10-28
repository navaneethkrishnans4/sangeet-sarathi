"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, User, School, IndianRupee, CheckCircle2, AlertCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  expectedFee: number;
  enrolmentMonth: string;
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

  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/ledger/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTeacher(data.teacher);
          setStudents(data.students);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/trinityentries/ledger" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
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
                  <School className="w-4 h-4" />
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
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-xl font-bold text-white">Enrolled Students ({students.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <th className="p-4 font-medium">Student Name</th>
                      <th className="p-4 font-medium">Subject & Grade</th>
                      <th className="p-4 font-medium text-center">Enrolment Month</th>
                      <th className="p-4 font-medium text-right">Fee Amount</th>
                      <th className="p-4 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {students.map((student) => {
                      const isPaid = student.paymentStatus === "Reconciled";
                      return (
                        <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-slate-200 font-medium">{student.name}</td>
                          <td className="p-4">
                            <div className="text-sm text-slate-300">{student.subject}</div>
                            <div className="text-xs text-slate-500">{student.grade}</div>
                          </td>
                          <td className="p-4 text-center text-sm text-slate-400">
                            {student.enrolmentMonth}
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
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          No candidates found for this teacher.
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
