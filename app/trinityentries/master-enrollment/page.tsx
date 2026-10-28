"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Music, 
  Radio, 
  Database, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye
} from "lucide-react";

export default function MasterEnrollmentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [suite, setSuite] = useState<"Classical & Jazz" | "Rock & Pop" | "auto">("auto");
  const [sessionMonth, setSessionMonth] = useState("November");
  const [dryRun, setDryRun] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const monthOptions = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setResult(null);
      setErrorMsg(null);

      // Auto-detect suite from file name if possible
      const name = selected.name.toLowerCase();
      if (name.includes("rock") || name.includes("pop")) {
        setSuite("Rock & Pop");
      } else if (name.includes("music") || name.includes("jazz") || name.includes("classical")) {
        setSuite("Classical & Jazz");
      } else {
        setSuite("auto");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Please select an Excel (.xlsx / .xls) file first!");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("suite", suite);
      formData.append("sessionMonth", sessionMonth);
      formData.append("dryRun", dryRun ? "true" : "false");

      const res = await fetch("/api/entries/master-upload", {
        method: "POST",
        body: formData
      });

      const json = await res.json();
      if (json.success) {
        setResult(json.data);
      } else {
        setErrorMsg(json.error || "An unknown error occurred while processing the spreadsheet.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to communicate with server.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 md:p-10 flex flex-col items-center">
      
      {/* Top Header */}
      <div className="max-w-5xl w-full flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Official Trinity Mass Enrolment Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Master Enrolment Processor
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload Mass Enrolment Spreadsheets. Auto-assigns Order Numbers, months, teachers, verified fees, and commits to multiple tables.
          </p>
        </div>

        <Link
          href="/trinityentries"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/60 px-4 py-2.5 rounded-xl border border-slate-700/60 hover:border-slate-500 text-sm font-medium shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      {/* Main Upload Card */}
      <div className="max-w-5xl w-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Suite Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              1. Select Exam Suite
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSuite("auto")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  suite === "auto"
                    ? "bg-blue-600/30 border-blue-500 text-blue-200 shadow-lg shadow-blue-500/10"
                    : "bg-slate-900/40 border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <Radio className="w-4 h-4" />
                Auto-Detect
              </button>

              <button
                type="button"
                onClick={() => setSuite("Classical & Jazz")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  suite === "Classical & Jazz"
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-lg shadow-indigo-500/10"
                    : "bg-slate-900/40 border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <Music className="w-4 h-4" />
                Classical & Jazz
              </button>

              <button
                type="button"
                onClick={() => setSuite("Rock & Pop")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  suite === "Rock & Pop"
                    ? "bg-rose-600/30 border-rose-500 text-rose-200 shadow-lg shadow-rose-500/10"
                    : "bg-slate-900/40 border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Rock & Pop
              </button>
            </div>
          </div>

          {/* Fallback Session Month & Dry Run */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                2. Default / Fallback Session Month
              </label>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <select
                  value={sessionMonth}
                  onChange={(e) => setSessionMonth(e.target.value)}
                  className="bg-transparent text-sm font-bold text-white focus:outline-none w-full cursor-pointer"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m} className="bg-slate-800 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Used if section header or portal mapping does not specify a specific date.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                3. Execution Mode
              </label>
              <label className="flex items-center gap-3 bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-900/80 transition-colors">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-200">
                    Preview / Dry Run Only
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Scan file and show stats without committing to database.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              4. Upload Master Spreadsheet File (.xlsx / .xls)
            </label>
            <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/80 rounded-2xl p-8 text-center transition-all bg-slate-900/30 hover:bg-slate-900/50 relative cursor-pointer group">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-4 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8 text-blue-400" />
                </div>
                {file ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-400 text-sm">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB — Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-300">
                      Drag & Drop or click to browse Master Enrolment Sheet
                    </p>
                    <p className="text-xs text-slate-500">
                      Accepts latest Trinity Mass Enrolment Excel templates with Order headers
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              ⚡ Deduplicates existing records & updates candidate payments, orders, teachers, and bank transactions.
            </span>
            <button
              type="submit"
              disabled={!file || isUploading}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                !file || isUploading
                  ? "bg-slate-700/50 text-slate-400 cursor-not-allowed"
                  : dryRun
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
                  : "bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-blue-600/20"
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing Spreadsheet...
                </>
              ) : dryRun ? (
                <>
                  <Eye className="w-4 h-4" />
                  Validate & Preview
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Enroll & Commit to Database
                </>
              )}
            </button>
          </div>

        </form>

        {/* Error Output */}
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-300">Processing Failed</h4>
              <p className="text-xs text-rose-200 whitespace-pre-wrap">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Results Panel */}
        {result && (
          <div className="space-y-6 pt-4 border-t border-slate-700/60 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                {result.isDryRun ? "Dry Run Preview Results" : "Enrolment & Sync Successful"}
              </h3>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
                Suite: {result.suite}
              </span>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4">
                <span className="text-xs text-slate-400">Total Rows Checked</span>
                <p className="text-2xl font-black text-white mt-1">
                  {result.totalRowsChecked}
                </p>
              </div>

              <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-4">
                <span className="text-xs text-emerald-400 font-semibold">New Candidates</span>
                <p className="text-2xl font-black text-emerald-300 mt-1">
                  +{result.newCandidatesEnrolled}
                </p>
              </div>

              <div className="bg-slate-900/60 border border-blue-500/30 rounded-2xl p-4">
                <span className="text-xs text-blue-400 font-semibold">Existing Synced</span>
                <p className="text-2xl font-black text-blue-300 mt-1">
                  {result.existingUpdated}
                </p>
              </div>

              <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4">
                <span className="text-xs text-amber-400 font-semibold">Total Verified Fee</span>
                <p className="text-2xl font-black text-amber-300 mt-1">
                  {result.totalFee}
                </p>
              </div>
            </div>

            {/* Orders Detected */}
            {result.orders && (
              <div className="bg-slate-900/40 border border-slate-700/40 rounded-2xl p-4">
                <span className="text-xs uppercase font-semibold text-slate-400 block mb-2">
                  Associated Order Numbers
                </span>
                <div className="flex flex-wrap gap-2">
                  {String(result.orders)
                    .replace(/\[|\]|'/g, "")
                    .split(",")
                    .map((ord: string) => ord.trim())
                    .filter(Boolean)
                    .map((ord: string) => (
                      <span
                        key={ord}
                        className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-medium text-slate-200"
                      >
                        {ord}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/trinityentries/database?table=Candidate"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                <Database className="w-4 h-4 text-rose-400" />
                View in Database Viewer
              </Link>

              <Link
                href="/trinityentries/reconciliation"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Open Reconciliation Dashboard
              </Link>

              <Link
                href="/trinityentries/ledger"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-blue-400" />
                View Teachers Ledger
              </Link>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
