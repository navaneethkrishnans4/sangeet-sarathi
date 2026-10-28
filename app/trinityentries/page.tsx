import Link from "next/link";
import { 
  FilePlus, 
  ArrowRightLeft, 
  BookOpen, 
  TrendingUp, 
  Database,
  Bot,
  ArrowLeft
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-10 flex flex-col items-center justify-center">
      
      {/* Top Header Navigation */}
      <div className="max-w-5xl w-full flex items-center justify-between mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 px-4 py-2 rounded-xl border border-slate-700/50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sangeet Sarathi Store
        </Link>
        <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
          Center 4048
        </span>
      </div>

      {/* Header Section */}
      <div className="max-w-4xl w-full text-center mb-14 space-y-3">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Trinity Master Dashboard
        </h1>
        <p className="text-slate-400 text-base sm:text-lg">
          Central hub for candidate enrolments, reconciliation, and financial insights.
        </p>
      </div>

      {/* Main Navigation Grid */}
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Fill Entries Card */}
        <Link href="/trinityentries/entries" className="group">
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
        <Link href="/trinityentries/reconciliation" className="group">
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
        <Link href="/trinityentries/ledger" className="group">
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

        {/* AI Assistant Card */}
        <Link href="/trinityentries/chat" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-purple-500/50 transition-all duration-300 shadow-xl hover:shadow-purple-500/10 cursor-pointer flex flex-col">
            <div className="bg-purple-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <Bot className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">AI Database Assistant</h2>
            <p className="text-slate-400 flex-grow">
              Ask natural language questions to query candidates, transactions, and audit records with Gemini.
            </p>
          </div>
        </Link>

        {/* Database Viewer Card */}
        <Link href="/trinityentries/database" className="group">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 hover:bg-slate-700/50 hover:border-rose-500/50 transition-all duration-300 shadow-xl hover:shadow-rose-500/10 cursor-pointer flex flex-col">
            <div className="bg-rose-500/20 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform duration-300">
              <Database className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Database Viewer</h2>
            <p className="text-slate-400 flex-grow">
              Directly view raw data inside all your database tables with real-time filters and search.
            </p>
          </div>
        </Link>

        {/* Monthly Income Card */}
        <div className="group cursor-not-allowed opacity-60">
          <div className="h-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 transition-all duration-300 shadow-xl flex flex-col">
            <div className="bg-amber-500/20 p-4 rounded-2xl w-fit mb-6">
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Monthly Income</h2>
            <p className="text-slate-400 flex-grow">
              Analytics and graphs for overall income and fee remission. <span className="text-amber-400 text-sm font-semibold ml-1">(Coming Soon)</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
