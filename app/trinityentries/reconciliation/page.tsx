"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  IndianRupee, 
  TrendingUp, 
  PieChart, 
  Clock, 
  RefreshCw,
  Building2,
  Check,
  X,
  Search,
  Filter,
  UserCheck,
  UserX
} from "lucide-react";
import Link from "next/link";

interface ReconciliationMetrics {
  totalReceived: number;
  classicalTotal: number;
  classicalExpected?: number;
  rockPopTotal: number;
  rockPopExpected?: number;
  remainingToReceive: number;
  totalExpectedFees: number;
}

interface ReconciledItem {
  id: string;
  candidateName: string;
  examType: string;
  grade: string;
  instrument: string;
  fee: number;
  teacherName: string;
  schoolName: string;
  reconciledStatus: "Reconciled" | "Pending" | "Mismatch";
  narration?: string;
  matchedAmount?: number;
}

interface UnmatchedDeposit {
  id: string;
  date: string;
  narration: string;
  amount: number;
  sourceBank: string;
}

export default function ReconciliationDashboard() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "candidates" | "unmatched">("summary");
  
  // Dashboard Metrics State
  const [metrics, setMetrics] = useState<ReconciliationMetrics>({
    totalReceived: 0,
    classicalTotal: 0,
    classicalExpected: 0,
    rockPopTotal: 0,
    rockPopExpected: 0,
    remainingToReceive: 0,
    totalExpectedFees: 0
  });

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<string>("");
  const [availableOrders, setAvailableOrders] = useState<{orderNumber: string, label: string}[]>([]);

  const [reconciledItems, setReconciledItems] = useState<ReconciledItem[]>([]);
  const [allCandidates, setAllCandidates] = useState<ReconciledItem[]>([]);
  const [unmatchedDeposits, setUnmatchedDeposits] = useState<UnmatchedDeposit[]>([]);
  const [logOutput, setLogOutput] = useState<string>("");

  // Candidate Status Filter & Search State
  const [candidateFilter, setCandidateFilter] = useState<"all" | "pending" | "reconciled">("pending");
  const [candidateSearch, setCandidateSearch] = useState<string>("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

  useEffect(() => {
    fetchInitialSummary();
  }, [selectedMonth, selectedOrder]);

  const fetchInitialSummary = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.append("month", selectedMonth);
      if (selectedOrder) params.append("orderNumber", selectedOrder);
      
      const res = await fetch(`/api/reconcile?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setReconciledItems(data.reconciledItems || []);
        setAllCandidates(data.allCandidates || data.reconciledItems || []);
        setUnmatchedDeposits(data.unmatchedDeposits || []);
        if (data.availableOrderNumbers) setAvailableOrders(data.availableOrderNumbers);
      }
    } catch (err) {
      console.error("Failed to load initial summary:", err);
    }
  };

  // Toggle single candidate paymentStatus
  const handleToggleCandidateStatus = async (candidateId: string, currentStatus: string) => {
    const targetStatus = currentStatus === "Reconciled" ? "Pending" : "Reconciled";
    setIsTogglingStatus(true);

    // Optimistic UI update
    setAllCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, reconciledStatus: targetStatus as any } : c));

    try {
      const res = await fetch("/api/reconcile/candidate-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchInitialSummary();
      } else {
        alert("Failed to update status: " + data.error);
        fetchInitialSummary();
      }
    } catch (err: any) {
      alert("Error updating candidate status: " + err.message);
      fetchInitialSummary();
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Bulk update selected candidates
  const handleBulkToggleStatus = async (targetStatus: "Reconciled" | "Pending") => {
    if (selectedCandidateIds.size === 0) return;
    setIsTogglingStatus(true);

    const candidateIds = Array.from(selectedCandidateIds);
    try {
      const res = await fetch("/api/reconcile/candidate-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds, status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCandidateIds(new Set());
        fetchInitialSummary();
      } else {
        alert("Failed bulk status update: " + data.error);
      }
    } catch (err: any) {
      alert("Error performing bulk status update: " + err.message);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const toggleSelectAll = (filteredList: ReconciledItem[]) => {
    if (selectedCandidateIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedCandidateIds(new Set());
    } else {
      setSelectedCandidateIds(new Set(filteredList.map(c => c.id)));
    }
  };

  const toggleSelectCandidate = (id: string) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type === "application/pdf" || file.name.endsWith(".pdf")
      );
      if (droppedFiles.length === 0) {
        alert("Please drop valid PDF bank statement files.");
        return;
      }
      if (selectedFiles.length + droppedFiles.length > 2) {
        alert("You can upload a maximum of 2 bank statement PDFs at a time.");
        return;
      }
      setSelectedFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => file.type === "application/pdf" || file.name.endsWith(".pdf"));
      if (selectedFiles.length + newFiles.length > 2) {
        alert("You can upload a maximum of 2 bank statement PDFs at a time.");
        return;
      }
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      alert("Please upload at least 1 bank statement PDF to reconcile.");
      return;
    }

    setIsUploading(true);
    setLogOutput("");

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append("statements", file);
      });

      const res = await fetch("/api/reconcile", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setMetrics(data.metrics);
        setReconciledItems(data.reconciledItems || []);
        setAllCandidates(data.allCandidates || data.reconciledItems || []);
        setUnmatchedDeposits(data.unmatchedDeposits || []);
        setLogOutput(data.message + "\n\nEngine Log:\n" + (data.output || "Reconciliation finished successfully."));
      } else {
        setLogOutput(`❌ ERROR\n\n${data.error}\n\nDetails:\n${data.details || ""}`);
      }
    } catch (err: any) {
      setLogOutput("Failed to run reconciliation engine: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return "₹ " + val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  // Filter candidates for display
  const displayedCandidates = allCandidates.filter(item => {
    const matchesFilter = 
      candidateFilter === "all" ? true :
      candidateFilter === "pending" ? item.reconciledStatus !== "Reconciled" :
      item.reconciledStatus === "Reconciled";

    const q = candidateSearch.toLowerCase();
    const matchesSearch = !q || 
      item.candidateName.toLowerCase().includes(q) ||
      item.teacherName.toLowerCase().includes(q) ||
      item.schoolName.toLowerCase().includes(q) ||
      item.examType.toLowerCase().includes(q) ||
      item.grade.toLowerCase().includes(q) ||
      item.instrument.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const pendingCount = allCandidates.filter(c => c.reconciledStatus !== "Reconciled").length;
  const reconciledCount = allCandidates.filter(c => c.reconciledStatus === "Reconciled").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 flex flex-col items-center">
      
      {/* Header */}
      <div className="max-w-6xl w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent mb-2">
            Bank Statement Reconciliation
          </h1>
          <p className="text-slate-400">Reconcile candidate fees automatically via bank PDFs or manually toggle student status.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="September">September</option>
            <option value="August">August</option>
            <option value="July">July</option>
            <option value="June">June</option>
            <option value="">All Months</option>
          </select>
          
          <select
            value={selectedOrder}
            onChange={(e) => setSelectedOrder(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 max-w-[200px] truncate"
          >
            <option value="">All Orders</option>
            {availableOrders.map(o => (
              <option key={o.orderNumber} value={o.orderNumber}>{o.label}</option>
            ))}
          </select>

          <Link href="/trinityentries/reconciliation/mapping" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 px-4 py-2 rounded-xl border border-slate-700 hover:border-emerald-500/50 text-sm font-semibold transition-all">
            <Building2 className="w-4 h-4" />
            Transaction Mapping & Rules
          </Link>
          <Link href="/trinityentries" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50 hover:border-slate-500 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* KEY METRICS GRID */}
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Metric 1: Total Received in Banks */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-400">Total Received in Banks</span>
            <div className="bg-emerald-500/20 p-2.5 rounded-xl">
              <IndianRupee className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-emerald-300 tracking-tight">
              {formatCurrency(metrics.totalReceived)}
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Verified from Bank PDFs
            </p>
          </div>
        </div>

        {/* Metric 2: Classical & Jazz Total */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-400">Classical & Jazz Fees</span>
            <div className="bg-blue-500/20 p-2.5 rounded-xl">
              <PieChart className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-blue-300 tracking-tight">
              {formatCurrency(metrics.classicalExpected || metrics.classicalTotal)}
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
              <span>Reconciled: <strong className="text-emerald-400">{formatCurrency(metrics.classicalTotal)}</strong></span>
            </p>
          </div>
        </div>

        {/* Metric 3: Rock & Pop Total */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-400">Rock & Pop Fees</span>
            <div className="bg-purple-500/20 p-2.5 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-purple-300 tracking-tight">
              {formatCurrency(metrics.rockPopExpected || metrics.rockPopTotal)}
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
              <span>Reconciled: <strong className="text-emerald-400">{formatCurrency(metrics.rockPopTotal)}</strong></span>
            </p>
          </div>
        </div>

        {/* Metric 4: Remaining to be Received */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-400">Remaining to Receive</span>
            <div className="bg-amber-500/20 p-2.5 rounded-xl">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-300 tracking-tight">
              {formatCurrency(metrics.remainingToReceive)}
            </div>
            <p className="text-xs text-slate-400 mt-2">Outstanding uncollected candidate balance</p>
          </div>
        </div>

      </div>

      {/* FILE UPLOADER CONTAINER */}
      <div className="max-w-6xl w-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-2xl mb-8">
        <form onSubmit={handleReconcileSubmit} className="space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" /> Upload Bank Statement PDFs
              </h2>
              <p className="text-sm text-slate-400 mt-1">Select 1 or 2 bank statement PDF files (Canara Bank / HDFC Bank) to execute reconciliation.</p>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
              Max 2 Files (.pdf)
            </span>
          </div>

          {/* Drag and Drop Zone */}
          <label 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer group ${
              isDragging 
                ? 'border-emerald-400 bg-emerald-500/20 scale-[1.01] shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                : 'border-emerald-500/30 hover:border-emerald-500/60 bg-slate-900/40 hover:bg-slate-900/60'
            }`}
          >
            <Upload className={`w-10 h-10 transition-all mb-3 ${isDragging ? 'text-emerald-300 scale-125' : 'text-slate-500 group-hover:text-emerald-400 group-hover:scale-110'}`} />
            <span className={`font-semibold text-sm transition-colors ${isDragging ? 'text-emerald-200' : 'text-slate-300 group-hover:text-emerald-300'}`}>
              {isDragging ? "Drop PDF Bank Statements Here..." : "Click to select PDF Bank Statements or Drag & Drop here"}
            </span>
            <span className="text-xs text-slate-500 mt-1">Supports HDFC & Canara Bank Statement PDF Formats</span>
            <input 
              type="file" 
              multiple 
              accept=".pdf" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={isUploading || selectedFiles.length >= 2}
            />
          </label>

          {/* Selected File Chips */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900/80 border border-slate-700 rounded-xl p-3.5">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-emerald-400" />
                    <div>
                      <div className="text-sm font-semibold text-slate-200 truncate max-w-xs">{file.name}</div>
                      <div className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeFile(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isUploading || selectedFiles.length === 0}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Processing Reconciliation Engine...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> Run Bank Reconciliation Engine
              </>
            )}
          </button>
        </form>

        {logOutput && (
          <div className="mt-6 bg-slate-950 border border-slate-700/80 rounded-xl p-5 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
            {logOutput}
          </div>
        )}
      </div>

      {/* RESULTS & BREAKDOWN TABS */}
      <div className="max-w-6xl w-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-700 mb-6 gap-6">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === "summary" ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Reconciliation Summary
          </button>
          <button
            onClick={() => setActiveTab("candidates")}
            className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === "candidates" ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Student Reconciliation & Manual Toggle ({allCandidates.length})
          </button>
          <button
            onClick={() => setActiveTab("unmatched")}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === "unmatched" ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Unmatched Deposits ({unmatchedDeposits.length})
          </button>
        </div>

        {/* TAB 1: SUMMARY */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/60 border border-slate-700/60 p-5 rounded-2xl space-y-1">
                <div className="text-xs text-slate-400 font-semibold">Total Fee Expectation</div>
                <div className="text-2xl font-bold text-slate-100">{formatCurrency(metrics.totalExpectedFees)}</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/60 p-5 rounded-2xl space-y-1">
                <div className="text-xs text-slate-400 font-semibold">Total Bank Collections</div>
                <div className="text-2xl font-bold text-emerald-400">{formatCurrency(metrics.totalReceived)}</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/60 p-5 rounded-2xl space-y-1">
                <div className="text-xs text-slate-400 font-semibold">Outstanding Pending Balance</div>
                <div className="text-2xl font-bold text-amber-400">{formatCurrency(metrics.remainingToReceive)}</div>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-base font-bold mb-3 text-slate-200">Reconciliation Options</h3>
              <ul className="space-y-2 text-xs text-slate-400 list-disc list-inside">
                <li><strong>Automated:</strong> Upload bank statement PDFs above to match deposits against candidate fees.</li>
                <li><strong>Manual:</strong> Switch to the <em>"Student Reconciliation & Manual Toggle"</em> tab to directly click tick ✓ or cross ✗ on any student to reconcile fees without needing a bank transaction!</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: CANDIDATE STATUS & MANUAL RECONCILIATION */}
        {activeTab === "candidates" && (
          <div className="space-y-6">
            
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 p-4 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search candidate, teacher, grade..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-64"
                  />
                </div>

                <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700 text-xs font-semibold">
                  <button
                    onClick={() => setCandidateFilter("pending")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${candidateFilter === "pending" ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Unassigned / Pending ({pendingCount})
                  </button>
                  <button
                    onClick={() => setCandidateFilter("reconciled")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${candidateFilter === "reconciled" ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Reconciled ({reconciledCount})
                  </button>
                  <button
                    onClick={() => setCandidateFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${candidateFilter === "all" ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    All ({allCandidates.length})
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedCandidateIds.size > 0 && (
                <div className="flex items-center gap-2 animate-fadeIn">
                  <span className="text-xs text-slate-400 font-semibold">{selectedCandidateIds.size} selected:</span>
                  <button
                    onClick={() => handleBulkToggleStatus("Reconciled")}
                    disabled={isTogglingStatus}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Reconcile Selected (✓)
                  </button>
                  <button
                    onClick={() => handleBulkToggleStatus("Pending")}
                    disabled={isTogglingStatus}
                    className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Mark Pending (✗)
                  </button>
                </div>
              )}
            </div>

            {/* Candidates Table */}
            <div className="overflow-x-auto">
              {displayedCandidates.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No candidates found matching the selected filter or search criteria.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/80 text-xs text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3.5 rounded-l-xl w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCandidateIds.size === displayedCandidates.length && displayedCandidates.length > 0}
                          onChange={() => toggleSelectAll(displayedCandidates)}
                          className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5">Candidate</th>
                      <th className="p-3.5">Exam / Grade</th>
                      <th className="p-3.5">Teacher / Academy</th>
                      <th className="p-3.5">Fee</th>
                      <th className="p-3.5">Payment Status</th>
                      <th className="p-3.5 rounded-r-xl text-center">Manual Reconcile Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedCandidates.map((item) => {
                      const isReconciled = item.reconciledStatus === "Reconciled";
                      const isSelected = selectedCandidateIds.has(item.id);

                      return (
                        <tr key={item.id} className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-slate-800/50' : ''}`}>
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCandidate(item.id)}
                              className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="p-3.5 font-semibold text-slate-100">{item.candidateName}</td>
                          <td className="p-3.5 text-xs text-slate-300">{item.examType} ({item.grade}) - {item.instrument}</td>
                          <td className="p-3.5 text-xs text-slate-300">{item.teacherName || item.schoolName || "-"}</td>
                          <td className="p-3.5 font-mono text-emerald-400 font-semibold">{formatCurrency(item.fee)}</td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isReconciled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                              {isReconciled ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-amber-400" />}
                              {isReconciled ? "Reconciled" : "Pending"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isReconciled ? (
                                <button
                                  onClick={() => handleToggleCandidateStatus(item.id, item.reconciledStatus)}
                                  disabled={isTogglingStatus}
                                  title="Manually Reconcile Student (✓)"
                                  className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm group cursor-pointer"
                                >
                                  <Check className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                                  <span>Reconcile (✓)</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleCandidateStatus(item.id, item.reconciledStatus)}
                                  disabled={isTogglingStatus}
                                  title="Unreconcile / Mark Pending (✗)"
                                  className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm group cursor-pointer"
                                >
                                  <X className="w-4 h-4 text-amber-400 group-hover:text-white" />
                                  <span>Mark Pending (✗)</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: UNMATCHED DEPOSITS */}
        {activeTab === "unmatched" && (
          <div className="overflow-x-auto">
            {unmatchedDeposits.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No unmatched bank deposits found. All deposits were successfully reconciled!
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3.5 rounded-l-xl">Date</th>
                    <th className="p-3.5">Narration / Details</th>
                    <th className="p-3.5">Source Bank</th>
                    <th className="p-3.5 rounded-r-xl">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {unmatchedDeposits.map((dep, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3.5 text-slate-400">{dep.date}</td>
                      <td className="p-3.5 font-mono text-xs text-slate-200">{dep.narration}</td>
                      <td className="p-3.5 text-slate-400">{dep.sourceBank}</td>
                      <td className="p-3.5 font-mono font-semibold text-amber-400">{formatCurrency(dep.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
