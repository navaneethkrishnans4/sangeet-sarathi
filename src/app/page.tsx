import Link from "next/link";
import { 
  FilePlus, 
  ArrowRightLeft, 
  BookOpen, 
  FileSpreadsheet, 
  Database,
  GraduationCap,
  ArrowRight
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-10 flex flex-col items-center justify-center">
      
      {/* Header Section */}
      <div className="max-w-4xl w-full text-center mb-8 space-y-3">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Trinity Master Dashboard
        </h1>
        <p className="text-slate-400 text-base sm:text-lg">
          Central hub for enrolments, reconciliation, and financial insights.
        </p>
      </div>

      {/* BIG TOP SECTION: Trinity College London Digital Exam Enrollment Portal */}
      <div className="max-w-5xl w-full mb-10">
        <Link 
          href="/trinityexamenrollmentportal" 
          className="group block cursor-pointer"
        >
          <div className="p-[2px] rounded-3xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-2xl shadow-amber-500/20 hover:shadow-amber-500/40 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
            <div className="bg-slate-950/95 hover:bg-slate-900/90 rounded-[22px] p-6 sm:p-7 flex flex-col gap-6 transition-colors">
              {/* Branding Logos Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="bg-white px-3.5 py-1.5 rounded-xl flex items-center shadow">
                  <img
                    src="/images/national-academy-of-music.png"
                    alt="National Academy of Music"
                    className="h-9 w-auto object-contain"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-amber-950 bg-amber-400 px-3 py-1 rounded-full font-mono">
                    Official Exam Portal
                  </span>
                  <span className="text-xs text-amber-200/90 font-semibold bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500/30">
                    Exam Centre: Kochi (4048)
                  </span>
                </div>
                <div className="bg-white px-3.5 py-1.5 rounded-xl flex items-center shadow">
                  <img
                    src="/images/trinity-college-london.png"
                    alt="Trinity College London"
                    className="h-8 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Title & Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-amber-300 transition-colors">
                    Trinity College London Digital Exam Enrollment Portal
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5">
                    Official candidate digital exam registration, Technical & Repertoire pathway options, instant fee calculation, and direct UPI payment gateway.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-4 rounded-xl text-base shrink-0 shadow-xl group-hover:translate-x-1 transition-all">
                  <span>Enter Enrollment Portal</span>
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Navigation Grid */}
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Fill Entries Card */}
        <Link href="/entries" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-blue-500/50 transition-all duration-300 shadow-xl hover:shadow-blue-500/10 cursor-pointer flex flex-col">
            <div className="bg-blue-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <FilePlus className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Fill Candidate Entries</h2>
            <p className="text-slate-400 flex-grow">
              Import candidates from WhatsApp, Excel, or Google Forms into the Master Sheet and Postgres database.
            </p>
          </div>
        </Link>

        {/* Reconciliation Dashboard Card */}
        <Link href="/reconciliation" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 shadow-xl hover:shadow-emerald-500/10 cursor-pointer flex flex-col">
            <div className="bg-emerald-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <ArrowRightLeft className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Reconciliation Dashboard</h2>
            <p className="text-slate-400 flex-grow">
              Upload bank statement PDFs to reconcile candidate fees against bank deposits.
            </p>
          </div>
        </Link>

        {/* Teachers Ledger Card */}
        <Link href="/ledger" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 shadow-xl hover:shadow-indigo-500/10 cursor-pointer flex flex-col">
            <div className="bg-indigo-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Teachers Ledger</h2>
            <p className="text-slate-400 flex-grow">
              View financial summaries for all teachers, track paid vs unpaid candidate statuses.
            </p>
          </div>
        </Link>

        {/* Master Enrolment Processor Card */}
        <Link href="/master-enrollment" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-teal-500/50 transition-all duration-300 shadow-xl hover:shadow-teal-500/10 cursor-pointer flex flex-col">
            <div className="bg-teal-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <FileSpreadsheet className="w-8 h-8 text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Master Enrolment</h2>
            <p className="text-slate-400 flex-grow">
              Upload Trinity Mass Enrolment Sheets (Music & Rock/Pop) to auto-assign Order Numbers, months, and reconcile fees.
            </p>
          </div>
        </Link>

        {/* Database Viewer Card */}
        <Link href="/database" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-rose-500/50 transition-all duration-300 shadow-xl hover:shadow-rose-500/10 cursor-pointer flex flex-col">
            <div className="bg-rose-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <Database className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Database Viewer</h2>
            <p className="text-slate-400 flex-grow">
              Directly view raw data inside all your database tables. Faster and more reliable than Prisma Studio!
            </p>
          </div>
        </Link>

        {/* Public Enrollment Form Card */}
        <Link href="/trinityexamenrollmentportal" className="group" target="_blank">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-amber-500/30 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-amber-400 transition-all duration-300 shadow-xl hover:shadow-amber-500/10 cursor-pointer flex flex-col relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/30">
              Public Portal
            </div>
            <div className="bg-amber-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <GraduationCap className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Trinity Exam Enrollment Portal</h2>
            <p className="text-slate-400 flex-grow">
              Shareable link for teachers & parents. Includes direct UPI payment, WhatsApp receipt notification, and instant verification summary.
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
}
