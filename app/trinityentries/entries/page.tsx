"use client";

import { useState } from "react";
import { MessageSquare, FileSpreadsheet, FormInput, ArrowLeft, Send, RefreshCw, Calendar } from "lucide-react";
import Link from "next/link";

const getNextMonthName = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleString("en-US", { month: "long" });
};

export default function EntriesPortal() {
  const [activeTab, setActiveTab] = useState<"whatsapp" | "excel" | "form" | "gsheet">("whatsapp");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [apiOutput, setApiOutput] = useState("");
  const [sessionMonth, setSessionMonth] = useState<string>(getNextMonthName());

  // Excel File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    examSuite: "Classical & Jazz",
    grade: "Grade 1",
    subject: "Piano",
    teacherName: "",
    schoolName: "",
    email: ""
  });

  const handleWhatsappSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiOutput("");
    
    try {
      const res = await fetch("/api/entries/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: whatsappText, sessionMonth })
      });
      const data = await res.json();
      
      if (data.success) {
        setApiOutput(`✅ SUCCESS\n\nGoogle Sheets Engine:\n${data.sheetOutput}\n\nDatabase Sync Engine:\n${data.dbOutput}`);
        setWhatsappText("");
      } else {
        setApiOutput(`❌ ERROR\n\n${data.error}\n\nDetails:\n${data.details || ""}`);
      }
    } catch (err) {
      setApiOutput("Failed to submit request to Next.js API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please select an Excel file first!");
      return;
    }

    setIsSubmitting(true);
    setApiOutput("");

    try {
      const body = new FormData();
      body.append("file", selectedFile);
      body.append("sessionMonth", sessionMonth);

      const res = await fetch("/api/entries/excel", {
        method: "POST",
        body
      });
      const data = await res.json();

      if (data.success) {
        setApiOutput(`✅ EXCEL UPLOAD SUCCESS\n\nGoogle Sheets Engine:\n${data.sheetOutput}\n\nDatabase Sync Engine:\n${data.dbOutput}`);
        setSelectedFile(null);
      } else {
        setApiOutput(`❌ ERROR\n\n${data.error}\n\nDetails:\n${data.details || ""}`);
      }
    } catch (err) {
      setApiOutput("Failed to upload Excel roster to API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiOutput("");

    try {
      const res = await fetch("/api/entries/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, sessionMonth })
      });
      const data = await res.json();

      if (data.success) {
        setApiOutput(`✅ MANUAL ENTRY SUCCESS\n\nGoogle Sheets Engine:\n${data.sheetOutput}\n\nDatabase Sync Engine:\n${data.dbOutput}`);
        setFormData({
          firstName: "",
          lastName: "",
          dob: "",
          examSuite: "Classical & Jazz",
          grade: "Grade 1",
          subject: "Piano",
          teacherName: "",
          schoolName: "",
          email: ""
        });
      } else {
        setApiOutput(`❌ ERROR\n\n${data.error}\n\nDetails:\n${data.details || ""}`);
      }
    } catch (err) {
      setApiOutput("Failed to submit manual candidate record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSheetSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiOutput("");
    
    try {
      const res = await fetch("/api/entries/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionMonth })
      });
      const data = await res.json();
      
      if (data.success) {
        setApiOutput(`✅ GOOGLE SHEETS SYNC SUCCESS\n\n${data.message}\n\nOutput Log:\n${data.output}`);
      } else {
        setApiOutput(`❌ SYNC ERROR\n\n${data.error}\n\nDetails:\n${data.details || ""}`);
      }
    } catch (err) {
      setApiOutput("Failed to trigger Google Sheet synchronization.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthOptions = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-10 flex flex-col items-center">
      
      {/* Header */}
      <div className="max-w-5xl w-full flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
            Data Entry Portal
          </h1>
          <p className="text-slate-400">Import candidates into the Master Sheet and PostgreSQL.</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Session Month Picker */}
          <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-2.5 shadow-lg">
            <Calendar className="w-4 h-4 text-blue-400" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Session Month</span>
              <select
                value={sessionMonth}
                onChange={(e) => setSessionMonth(e.target.value)}
                className="bg-transparent text-sm font-bold text-blue-300 focus:outline-none cursor-pointer"
              >
                {monthOptions.map(m => (
                  <option key={m} value={m} className="bg-slate-800 text-white">{m}</option>
                ))}
              </select>
            </div>
          </div>

          <Link href="/trinityentries/master-enrollment" className="flex items-center gap-2 text-teal-300 hover:text-white transition-colors bg-teal-500/20 hover:bg-teal-500/30 px-4 py-2.5 rounded-xl border border-teal-500/40 text-sm font-semibold shadow-md">
            <FileSpreadsheet className="w-4 h-4" />
            Master Sheet Processor
          </Link>

          <Link href="/trinityentries" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-4 py-2.5 rounded-xl border border-slate-700/50 hover:border-slate-500 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl w-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
        
        {/* Tab Selection */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => setActiveTab("whatsapp")}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 border ${activeTab === "whatsapp" ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-700/50'}`}
          >
            <MessageSquare className={`w-8 h-8 ${activeTab === "whatsapp" ? 'text-blue-400' : 'text-slate-400'}`} />
            <span className={`font-semibold ${activeTab === "whatsapp" ? 'text-blue-300' : 'text-slate-400'}`}>WhatsApp Msg</span>
          </button>

          <button 
            onClick={() => setActiveTab("gsheet")}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 border ${activeTab === "gsheet" ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-700/50'}`}
          >
            <RefreshCw className={`w-8 h-8 ${activeTab === "gsheet" ? 'text-amber-400 animate-spin-slow' : 'text-slate-400'}`} />
            <span className={`font-semibold ${activeTab === "gsheet" ? 'text-amber-300' : 'text-slate-400'}`}>Google Sheet Sync</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("excel")}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 border ${activeTab === "excel" ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-700/50'}`}
          >
            <FileSpreadsheet className={`w-8 h-8 ${activeTab === "excel" ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className={`font-semibold ${activeTab === "excel" ? 'text-emerald-300' : 'text-slate-400'}`}>Excel Upload</span>
          </button>

          <button 
            onClick={() => setActiveTab("form")}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 border ${activeTab === "form" ? 'bg-purple-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-700/50'}`}
          >
            <FormInput className={`w-8 h-8 ${activeTab === "form" ? 'text-purple-400' : 'text-slate-400'}`} />
            <span className={`font-semibold ${activeTab === "form" ? 'text-purple-300' : 'text-slate-400'}`}>Manual Form</span>
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
          
          {/* WHATSAPP TAB */}
          {activeTab === "whatsapp" && (
            <form onSubmit={handleWhatsappSubmit} className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold mb-2 text-blue-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400"/> Parse WhatsApp Message
              </h3>
              <p className="text-sm text-slate-400 mb-2">Paste raw WhatsApp entry messages below. Extracts details, appends to Master Google Sheet, and syncs into PostgreSQL under session month <span className="font-bold text-blue-300">{sessionMonth}</span>.</p>
              <textarea 
                className="w-full h-48 bg-slate-800 border border-slate-600 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                placeholder="Candidate Name: John Doe&#10;Exam Suite: Rock & Pop&#10;Grade: Initial&#10;..."
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                required
              />
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Processing & Syncing...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5"/> Push to Google Sheet & Postgres ({sessionMonth})
                  </>
                )}
              </button>
            </form>
          )}

          {/* GOOGLE SHEET SYNC TAB */}
          {activeTab === "gsheet" && (
            <form onSubmit={handleSheetSync} className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold mb-2 text-amber-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-400"/> Live Google Sheet Synchronization
              </h3>
              <p className="text-sm text-slate-400 mb-2">
                If candidates or entries were manually edited or added directly inside your Google Sheets (Classical & Jazz or Rock & Pop), click below to sync all live changes into PostgreSQL under session month <span className="font-bold text-amber-300">{sessionMonth}</span>.
              </p>
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Active Master Spreadsheets Connected:
                </div>
                <div className="pl-4">📄 Classical & Jazz Enrolment Sheet</div>
                <div className="pl-4">📄 Rock & Pop Enrolment Sheet</div>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="mt-4 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="animate-pulse flex items-center gap-2"><RefreshCw className="w-5 h-5 animate-spin" /> Syncing Live Sheets...</span>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5"/> Sync Live Google Sheets Now ({sessionMonth})
                  </>
                )}
              </button>
            </form>
          )}

          {/* EXCEL TAB */}
          {activeTab === "excel" && (
            <form onSubmit={handleExcelSubmit} className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold mb-2 text-emerald-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400"/> Upload Excel Roster
              </h3>
              <p className="text-sm text-slate-400 mb-2">Upload a legacy teacher/school Excel roster file (.xlsx) to parse and append to the Master Google Sheet under session month <span className="font-bold text-emerald-300">{sessionMonth}</span>.</p>
              <label className="w-full h-48 border-2 border-dashed border-emerald-500/30 rounded-xl flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-pointer group">
                <FileSpreadsheet className="w-12 h-12 text-slate-500 group-hover:text-emerald-400 transition-colors mb-4" />
                <span className="text-slate-400 group-hover:text-emerald-300 font-medium">
                  {selectedFile ? selectedFile.name : "Click to select an Excel (.xlsx) file"}
                </span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </label>
              <button 
                type="submit" 
                disabled={isSubmitting || !selectedFile}
                className="mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Parsing Roster & Appending...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5"/> Upload & Push to Google Sheet ({sessionMonth})
                  </>
                )}
              </button>
            </form>
          )}

          {/* MANUAL FORM TAB */}
          {activeTab === "form" && (
            <form onSubmit={handleManualFormSubmit} className="flex flex-col gap-6">
               <h3 className="text-xl font-semibold mb-2 text-purple-100 flex items-center gap-2">
                <FormInput className="w-5 h-5 text-purple-400"/> Direct Candidate Entry
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">First Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">Last Name</label>
                  <input 
                    type="text" 
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">DOB (DD/MM/YYYY)</label>
                  <input 
                    type="text" 
                    placeholder="19/10/2011"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">Exam Suite *</label>
                  <select 
                    value={formData.examSuite}
                    onChange={(e) => setFormData({ ...formData, examSuite: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="Classical & Jazz">Classical & Jazz</option>
                    <option value="Rock & Pop">Rock & Pop</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">Grade *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Grade 1"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">Subject / Instrument</label>
                  <input 
                    type="text" 
                    placeholder="Piano, Vocals, Electronic Keyboard"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">Teacher / Submitter Name</label>
                  <input 
                    type="text" 
                    placeholder="Annson Mathews"
                    value={formData.teacherName}
                    onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 ml-1">School / Academy Name</label>
                  <input 
                    type="text" 
                    placeholder="Notes & Chords School of Music"
                    value={formData.schoolName}
                    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" 
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="mt-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Submitting to Master Sheet...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5"/> Submit Record to Google Sheet ({sessionMonth})
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {apiOutput && (
          <div className="mt-8 bg-slate-900/80 border border-slate-600 rounded-xl p-6 text-sm text-slate-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
            {apiOutput}
          </div>
        )}
      </div>
    </div>
  );
}
