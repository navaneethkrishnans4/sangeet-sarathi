"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Trash2, 
  Check, 
  Search, 
  CheckCircle2, 
  X,
  UserPlus,
  ListChecks
} from "lucide-react";
import Link from "next/link";

interface TempTransaction {
  id: string;
  date: string;
  narration: string;
  amount: number;
  mappedTeacherId: string;
  mappedTeacherName: string;
  mappedSchoolName: string;
  matchMethod: string;
  isRuleSaved: boolean;
}

interface TeacherOption {
  id: string;
  displayName: string;
}

interface RuleItem {
  id: string;
  alias: string;
  teacherName: string;
}

interface Candidate {
  id: string;
  name: string;
  grade: string;
  fee: number;
  teacherId: string | null;
  teacherName: string;
  schoolName: string;
  paymentStatus: string;
}

export default function TransactionMappingPage() {
  const [tempTransactions, setTempTransactions] = useState<TempTransaction[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedToIgnore, setSelectedToIgnore] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<"desc" | "asc" | "none">("none");
  const [dataSource, setDataSource] = useState<"temp" | "main">("temp");
  const [selectedMonth, setSelectedMonth] = useState<string>("August");

  useEffect(() => {
    fetchMappingData();
  }, [selectedMonth]);

  const fetchMappingData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reconcile/mapping?month=${selectedMonth}`);
      const data = await res.json();
      if (data.success) {
        setDataSource(data.dataSource || "temp");
        setTempTransactions(data.tempTransactions || []);
        setTeachers(data.teachers || []);
        setRules(data.rules || []);
        setCandidates(data.candidates || []);
      }
    } catch (err) {
      console.error("Failed to load mapping data:", err);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 5000);
  };

  // Re-map teacher for a transaction
  const handleTeacherChange = async (tempId: string, newTeacherId: string) => {
    const selectedTeacher = teachers.find(t => t.id === newTeacherId);
    setTempTransactions(prev => prev.map(t => {
      if (t.id === tempId) {
        return {
          ...t,
          mappedTeacherId: newTeacherId,
          mappedTeacherName: selectedTeacher?.displayName || "",
          matchMethod: "Manual Override"
        };
      }
      return t;
    }));

    try {
      const res = await fetch("/api/reconcile/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remap", tempId, teacherId: newTeacherId, dataSource })
      });
      const data = await res.json();
      if (data.success) showStatus(`✅ Re-mapped transaction to ${selectedTeacher?.displayName}`);
    } catch (err) {
      console.error("Failed to remap teacher:", err);
    }
  };

  // Move candidate to/from a teacher
  const handleCandidateReassign = async (candidateId: string, newTeacherId: string | null) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { ...c, teacherId: newTeacherId };
      }
      return c;
    }));

    try {
      const res = await fetch("/api/reconcile/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_candidate_teacher", candidateId, teacherId: newTeacherId })
      });
      const data = await res.json();
      if (!data.success) {
        showStatus("❌ Failed to move candidate. Try again.");
        fetchMappingData();
      }
    } catch (err) {
      console.error("Failed to update candidate:", err);
    }
  };

  const handleSaveHeaderRule = async (tempTx: TempTransaction) => {
    if (!tempTx.mappedTeacherId) {
      alert("Please select a teacher for this transaction before saving the header rule.");
      return;
    }
    setTempTransactions(prev => prev.map(t => {
      if (t.id === tempTx.id) {
        return { ...t, isRuleSaved: true, matchMethod: "Pass 1: Saved Rule" };
      }
      return t;
    }));

    try {
      const res = await fetch("/api/reconcile/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_rule", tempId: tempTx.id, teacherId: tempTx.mappedTeacherId, customAlias: tempTx.narration, dataSource })
      });
      const data = await res.json();
      if (data.success) {
        showStatus(`🎉 Saved rule! Future transactions will auto-map.`);
      }
    } catch (err) {
      console.error("Failed to save rule:", err);
    }
  };

  const handleClearTempTable = async () => {
    if (!confirm("Are you sure you want to clear all temporary session bank transactions?")) return;
    setIsProcessing(true);
    try {
      const res = await fetch("/api/reconcile/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_temp" })
      });
      const data = await res.json();
      if (data.success) {
        setTempTransactions([]);
        setSelectedToIgnore(new Set());
        showStatus("🗑️ Temporary workspace cleared.");
        fetchMappingData();
      }
    } catch (err) {
      console.error("Failed to clear temp table:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIgnoreSelected = async () => {
    if (selectedToIgnore.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedToIgnore.size} junk transaction(s)?`)) return;
    
    setIsProcessing(true);
    try {
      const selectedArray = Array.from(selectedToIgnore);
      const res = await fetch("/api/reconcile/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore_transactions", tempIds: selectedArray, dataSource })
      });
      const data = await res.json();
      if (data.success) {
        showStatus(`🗑️ ${data.message}`);
        setSelectedToIgnore(new Set());
        fetchMappingData();
      }
    } catch (err) {
      console.error("Failed to ignore transactions:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveMappingsToDb = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/reconcile/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_mappings_to_db", dataSource, sessionMonth: selectedMonth })
      });
      const data = await res.json();
      if (data.success) {
        showStatus("💾 Saved updates and refreshed workspace.");
        alert("Successfully saved mappings to the BankTransaction database!");
        fetchMappingData();
      }
    } catch (err) {
      console.error("Failed to save mappings:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number) => "₹ " + val.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const formatGrade = (gradeStr: string) => {
    if (gradeStr.includes("Initial")) return "Initial";
    const match = gradeStr.match(/Grade\s*(\d+|IN)/i);
    return match ? match[0] : gradeStr.slice(0, 10);
  };

  const filteredTransactions = tempTransactions.filter(t => {
    const s = searchQuery.toLowerCase();
    const narrationMatch = t.narration.toLowerCase().includes(s);
    const teacherMatch = t.mappedTeacherName.toLowerCase().includes(s);
    const amountMatch = t.amount.toString().includes(s);
    
    const candidatesForTeacher = t.mappedTeacherId ? candidates.filter(c => c.teacherId === t.mappedTeacherId) : [];
    const candidateMatch = candidatesForTeacher.some(c => c.name.toLowerCase().includes(s));

    return narrationMatch || teacherMatch || amountMatch || candidateMatch;
  });

  const groupedTransactions: Record<string, {
    teacherName: string, 
    transactions: TempTransaction[], 
    candidates: Candidate[]
  }> = {};

  let unmappedTransactions: TempTransaction[] = [];

  filteredTransactions.forEach(tx => {
    if (tx.mappedTeacherId) {
      if (!groupedTransactions[tx.mappedTeacherId]) {
        groupedTransactions[tx.mappedTeacherId] = {
          teacherName: tx.mappedTeacherName,
          transactions: [],
          candidates: candidates.filter(c => c.teacherId === tx.mappedTeacherId)
        };
      }
      groupedTransactions[tx.mappedTeacherId].transactions.push(tx);
    } else {
      unmappedTransactions.push(tx);
    }
  });

  unmappedTransactions.sort((a, b) => {
    if (sortOrder === "asc") return a.amount - b.amount;
    if (sortOrder === "desc") return b.amount - a.amount;
    return 0;
  });

  const bgColors = ["bg-slate-800/60", "bg-indigo-900/20", "bg-cyan-900/20", "bg-emerald-900/20", "bg-rose-900/20"];

  const leftOutCandidates = candidates.filter(c => 
    c.paymentStatus !== "Reconciled" && 
    (!c.teacherId || (!groupedTransactions[c.teacherId] && !tempTransactions.some(t => t.mappedTeacherId === c.teacherId)))
  );

  const allUnmappedSelected = unmappedTransactions.length > 0 && unmappedTransactions.every(tx => selectedToIgnore.has(tx.id));

  const handleSelectAllUnmapped = (checked: boolean) => {
    if (checked) {
      const unmappedIds = unmappedTransactions.map(tx => tx.id);
      setSelectedToIgnore(new Set([...selectedToIgnore, ...unmappedIds]));
    } else {
      const newSet = new Set(selectedToIgnore);
      unmappedTransactions.forEach(tx => newSet.delete(tx.id));
      setSelectedToIgnore(newSet);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8 font-sans overflow-x-hidden">
      
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <ListChecks className="text-emerald-400" />
              Transactions Mapping Engine
            </h2>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${dataSource === 'temp' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              {dataSource === 'temp' ? 'Currently viewing: Temporary Workspace' : 'Currently viewing: Saved Main Database'}
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-1">Review grouped transactions, assign candidates, and save rules.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleClearTempTable}
            disabled={isProcessing || tempTransactions.length === 0}
            className="flex items-center gap-2 bg-slate-900 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 border border-slate-800 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Clear Temp Table
          </button>

          <button
            onClick={handleSaveMappingsToDb}
            disabled={isProcessing || tempTransactions.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Mappings to DB
          </button>

          <Link href="/trinityentries/reconciliation" className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-800 px-4 py-2.5 rounded-lg border border-slate-700 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Overview
          </Link>
        </div>
      </div>

      {statusMessage && (
        <div className="max-w-7xl mx-auto mb-6 bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 px-5 py-3 rounded-lg text-sm flex justify-between animate-fade-in">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Table: Grouped Transactions with horizontal scroll */}
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 mb-10 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Grouped Transactions & Matched Candidates</h2>
          <div className="flex items-center gap-4">
            {selectedToIgnore.size > 0 && (
              <button
                onClick={handleIgnoreSelected}
                disabled={isProcessing}
                className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ignore Selected ({selectedToIgnore.size})
              </button>
            )}
            
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="September">September</option>
              <option value="August">August</option>
              <option value="July">July</option>
              <option value="June">June</option>
            </select>

            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : tempTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {dataSource === "temp" 
              ? "No transactions in temporary workspace." 
              : "No pending or mismatched transactions in the saved main database. All past transactions are fully settled!"}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm border-collapse min-w-[1100px]">
              <thead className="bg-slate-950/80 text-xs text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="p-4 border-b border-slate-800 whitespace-nowrap">Bank Narration</th>
                  <th className="p-4 border-b border-slate-800">Amount</th>
                  <th className="p-4 border-b border-slate-800">Matched Teacher</th>
                  <th className="p-4 border-b border-slate-800 min-w-[300px]">Candidates in Row</th>
                  <th className="p-4 border-b border-slate-800 text-center whitespace-nowrap">Header Rule</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedTransactions).map(([teacherId, group], index) => {
                  const bgColor = bgColors[index % bgColors.length];
                  
                  return group.transactions.map((tx, txIdx) => (
                    <tr key={tx.id} className={`${bgColor} border-b border-slate-800/50 hover:brightness-110 transition-all`}>
                      <td className="p-4 font-mono text-xs text-slate-300 max-w-xs truncate" title={tx.narration}>
                        {tx.date} - {tx.narration}
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="p-4 min-w-[200px]">
                        <select
                          value={tx.mappedTeacherId}
                          onChange={(e) => handleTeacherChange(tx.id, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Unassign --</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>{t.displayName}</option>
                          ))}
                        </select>
                        <div className="mt-1 text-[10px] text-slate-500">{tx.matchMethod}</div>
                      </td>
                      
                      {/* Show Candidates only on the first row of the group */}
                      {txIdx === 0 ? (
                        <td className="p-4" rowSpan={group.transactions.length}>
                          {(() => {
                            const totalTxAmount = group.transactions.reduce((sum, t) => sum + t.amount, 0);
                            const totalCandidateFee = group.candidates.reduce((sum, c) => sum + c.fee, 0);
                            const isMismatch = group.candidates.length > 0 && Math.abs(totalTxAmount - totalCandidateFee) >= 1.0;

                            return (
                              <div className={`flex flex-wrap gap-2 p-2 rounded-lg ${isMismatch ? 'bg-rose-950/30 border border-rose-900/50' : ''}`}>
                                {group.candidates.length === 0 && <span className="text-xs text-slate-500 italic">No candidates assigned</span>}
                                {isMismatch && (
                                  <div className="w-full text-[10px] text-rose-400 font-bold mb-1 uppercase tracking-wider">
                                    ⚠️ Amount Mismatch: Transacted {formatCurrency(totalTxAmount)} vs Candidates {formatCurrency(totalCandidateFee)}
                                  </div>
                                )}
                                {group.candidates.map(c => (
                                  <div key={c.id} className={`inline-flex items-center border rounded-md py-1 pl-2 pr-1 text-xs ${isMismatch ? 'bg-rose-950 border-rose-800' : 'bg-slate-950/80 border-slate-700'}`}>
                                    <span className={isMismatch ? 'text-rose-200 font-medium' : 'text-slate-200 font-medium'}>{c.name}</span>
                                    <span className={`${isMismatch ? 'text-rose-400' : 'text-slate-500'} ml-1.5 mr-2`} title={c.grade}>({formatGrade(c.grade)})</span>
                                    <button 
                                      onClick={() => handleCandidateReassign(c.id, null)}
                                      className={`${isMismatch ? 'text-rose-400 hover:text-rose-200 hover:bg-rose-900' : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'} rounded p-0.5 transition-colors`}
                                      title="Remove student from this group"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                      ) : null}

                      <td className="p-4 text-center whitespace-nowrap">
                        {tx.isRuleSaved ? (
                          <span className="inline-flex items-center text-xs font-medium text-emerald-400">
                            <Check className="w-3.5 h-3.5 mr-1" /> Saved
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSaveHeaderRule(tx)}
                            className="bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                          >
                            Save Rule
                          </button>
                        )}
                      </td>
                    </tr>
                  ));
                })}

                {/* Unmapped Transactions */}
                {unmappedTransactions.length > 0 && (
                  <tr>
                    <td colSpan={5} className="p-2 bg-amber-950/40 border-b border-amber-900/50">
                      <div className="flex items-center justify-between pl-2 pr-2">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                            checked={allUnmappedSelected}
                            onChange={(e) => handleSelectAllUnmapped(e.target.checked)}
                          />
                          <span className="text-amber-200 text-xs font-bold uppercase tracking-wider">Select All Unassigned Transactions</span>
                        </div>
                        <button
                          onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : prev === "asc" ? "none" : "desc")}
                          className="text-xs font-semibold bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 px-3 py-1.5 rounded-md transition-colors border border-amber-800/50"
                        >
                          Sort Amount: {sortOrder === "none" ? "OFF" : sortOrder === "desc" ? "HIGH ⬇" : "LOW ⬆"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {unmappedTransactions.map(tx => (
                  <tr key={tx.id} className={`${selectedToIgnore.has(tx.id) ? 'bg-rose-950/20' : 'bg-amber-950/20'} border-b border-slate-800/50`}>
                    <td className="p-4 font-mono text-xs text-slate-300 max-w-xs truncate" title={tx.narration}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900"
                          checked={selectedToIgnore.has(tx.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedToIgnore);
                            if (e.target.checked) newSet.add(tx.id);
                            else newSet.delete(tx.id);
                            setSelectedToIgnore(newSet);
                          }}
                        />
                        <span>{tx.date} - {tx.narration}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="p-4 min-w-[200px]">
                      <select
                        value=""
                        onChange={(e) => handleTeacherChange(tx.id, e.target.value)}
                        className="w-full bg-amber-950/40 border border-amber-900/50 rounded-md px-2 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- Assign Teacher --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.displayName}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-slate-500 italic">Assign a teacher to add students</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs text-amber-500">Needs Teacher</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Left-Out Students Table */}
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            Unassigned / Left-Out Students
          </h2>
          <p className="text-xs text-slate-500 mt-1">These candidates are pending payment but are not currently assigned to any mapped teacher group above.</p>
        </div>
        
        <div className="p-6">
          {leftOutCandidates.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">All pending students have been assigned to groups!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {leftOutCandidates.map(c => (
                <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-slate-600 transition-colors">
                  <div className="mb-3">
                    <div className="font-semibold text-slate-200 text-sm">{c.name}</div>
                    <div className="text-xs text-slate-500 line-clamp-1" title={c.grade}>{formatGrade(c.grade)}</div>
                    <div className="text-[10px] text-slate-400 mt-1 italic leading-tight">
                      {c.schoolName || c.teacherName ? `${c.schoolName} ${c.schoolName && c.teacherName ? ' - ' : ''} ${c.teacherName}`.trim() : "No Academy Info"}
                    </div>
                    <div className="text-xs font-mono text-emerald-400 mt-1.5">{formatCurrency(c.fee)}</div>
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleCandidateReassign(c.id, e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Assign to Teacher Group...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
