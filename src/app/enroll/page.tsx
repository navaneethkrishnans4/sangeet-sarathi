"use client";

import React, { useState, useId } from "react";
import { 
  Music, 
  Drum, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  CreditCard, 
  Send, 
  Copy, 
  Check, 
  AlertCircle, 
  Phone, 
  User, 
  Mail, 
  Building2, 
  GraduationCap, 
  Calendar, 
  Sparkles, 
  QrCode, 
  ChevronRight, 
  ArrowRight, 
  Printer, 
  Table as TableIcon,
  X,
  Eye,
  Landmark
} from "lucide-react";

interface CandidateForm {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "M" | "F";
  examSuite: "Classical & Jazz" | "Rock & Pop";
  instrument: string;
  grade: string;
  schoolName: string;
  hasNoSchool: boolean;
}

// Capitalization: Title Case with single-letter uppercase (e.g. Navneeth krishnan s -> Navneeth Krishnan S)
function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map(word => {
      if (word.length === 1) return word.toUpperCase();
      if (/^[A-Za-z](\.[A-Za-z])*\.?$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// Music School exceptions (e.g. National Academy of Music, Notes n Tones Music Academy, Notes n Chords)
function toSchoolTitleCase(str: string): string {
  if (!str) return "";
  const lowerExceptions = new Set(["of", "n", "and", "&", "the", "in", "at", "for", "on", "to", "by"]);
  const words = str.trim().split(/\s+/);
  return words
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && lowerExceptions.has(lower)) {
        return lower === "&" ? "&" : lower;
      }
      if (word.length === 1) return word.toUpperCase();
      if (/^[A-Za-z](\.[A-Za-z])*\.?$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// DOB Validation (1940 to current year)
function validateDob(dobStr?: string): { valid: boolean; error?: string; formatted?: string } {
  if (!dobStr || !dobStr.trim()) {
    return { valid: false, error: "Date of Birth is required." };
  }
  const clean = dobStr.trim().replace(/[-.]/g, "/");
  const parts = clean.split("/");
  if (parts.length !== 3) {
    return { valid: false, error: "Please enter Date of Birth in DD/MM/YYYY format (e.g. 18/06/2011)." };
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  const currentYear = new Date().getFullYear();

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, error: "Invalid numbers in Date of Birth." };
  }
  if (year < 1940 || year > currentYear) {
    return { valid: false, error: `Birth year must be between 1940 and ${currentYear} (you entered ${year}).` };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid birth month: ${month}. Must be between 1 and 12.` };
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: `Invalid birth day: ${day}. Must be between 1 and 31.` };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { valid: false, error: `Invalid date: ${day}/${month}/${year} (month ${month} has only ${daysInMonth} days).` };
  }

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return {
    valid: true,
    formatted: `${pad(day)}/${pad(month)}/${year}`
  };
}

// Classical & Jazz instruments include Drum Kit
const CLASSICAL_INSTRUMENTS = [
  "Electronic Keyboard",
  "Piano",
  "Drum Kit",
  "Acoustic Guitar",
  "Classical Guitar",
  "Violin",
  "Saxophone",
  "Singing / Vocals",
  "Flute",
  "Cello",
  "Other"
];

// Rock & Pop instruments include Drums
const ROCK_POP_INSTRUMENTS = [
  "Drums",
  "Vocals",
  "Acoustic Guitar",
  "Electric Guitar",
  "Bass",
  "Keyboards",
  "Other"
];

const GRADES_WITH_FEES = [
  { grade: "Initial", fee: 5500 },
  { grade: "Grade 1", fee: 6050 },
  { grade: "Grade 2", fee: 6700 },
  { grade: "Grade 3", fee: 7700 },
  { grade: "Grade 4", fee: 8600 },
  { grade: "Grade 5", fee: 9700 },
  { grade: "Grade 6", fee: 11300 },
  { grade: "Grade 7", fee: 12200 },
  { grade: "Grade 8", fee: 13500 },
];

const DEFAULT_UPI_ID = "mssangeetsarath@eazypay@icici";
const BANK_ACCOUNT_NUMBER = "026205005146";
const BANK_IFSC_CODE = "ICIC0000262";
const BANK_BENEFICIARY = "M/s Sangeet Sarathi";
const BANK_NAME = "ICICI Bank";
const WHATSAPP_NUMBER = "6282920294";

export default function PublicEnrollPage() {
  const formId = useId();

  // Page Step: "form" = Step 1, "payment" = Step 2
  const [currentStep, setCurrentStep] = useState<"form" | "payment">("form");

  // Candidates list (Section 1)
  const [candidates, setCandidates] = useState<CandidateForm[]>([
    {
      id: "c-1",
      firstName: "",
      lastName: "",
      dob: "",
      gender: "M",
      examSuite: "Classical & Jazz",
      instrument: "Electronic Keyboard",
      grade: "Grade 1",
      schoolName: "",
      hasNoSchool: false
    }
  ]);

  // Contact details (Section 2: Email, Submitter Name, Phone, Teacher)
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterMobile, setSubmitterMobile] = useState("");
  const [teacherName, setTeacherName] = useState("");

  // Payment portal states
  const [paymentRef, setPaymentRef] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Review Modal state (Verification pop-up before final submit)
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);

  // Compute total fee
  const totalFee = candidates.reduce((sum, c) => {
    const item = GRADES_WITH_FEES.find(g => g.grade.toLowerCase() === c.grade.toLowerCase());
    return sum + (item ? item.fee : 6050);
  }, 0);

  // Add Candidate - Auto-populates school from previous candidates
  const handleAddCandidate = () => {
    let latestSchool = "";
    let latestNoSchool = false;
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].hasNoSchool) {
        latestNoSchool = true;
        latestSchool = "";
        break;
      }
      if (candidates[i].schoolName && candidates[i].schoolName.trim()) {
        latestSchool = candidates[i].schoolName.trim();
        break;
      }
    }

    setCandidates(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        firstName: "",
        lastName: "",
        dob: "",
        gender: "M",
        examSuite: "Classical & Jazz",
        instrument: "Electronic Keyboard",
        grade: "Grade 1",
        schoolName: latestSchool,
        hasNoSchool: latestNoSchool
      }
    ]);
  };

  // Remove Candidate
  const handleRemoveCandidate = (index: number) => {
    if (candidates.length <= 1) return;
    setCandidates(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update candidate field with automatic Drum Kit / Drums suite mapping
  const updateCandidate = (index: number, field: keyof CandidateForm, value: any) => {
    setCandidates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If suite changed, make sure instrument fits
      if (field === "examSuite") {
        if (value === "Rock & Pop") {
          if (updated[index].instrument === "Drum Kit") {
            updated[index].instrument = "Drums";
          } else if (!ROCK_POP_INSTRUMENTS.includes(updated[index].instrument)) {
            updated[index].instrument = "Drums";
          }
        } else if (value === "Classical & Jazz") {
          if (updated[index].instrument === "Drums") {
            updated[index].instrument = "Drum Kit";
          } else if (!CLASSICAL_INSTRUMENTS.includes(updated[index].instrument)) {
            updated[index].instrument = "Electronic Keyboard";
          }
        }
      }

      return updated;
    });
  };

  // Helper to copy a typed school name to all candidate cards
  const applySchoolToAll = (schoolToApply: string) => {
    const formatted = toSchoolTitleCase(schoolToApply);
    setCandidates(prev => prev.map(c => ({
      ...c,
      schoolName: formatted,
      hasNoSchool: false
    })));
  };

  // Copy to clipboard helper with visual indicator
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // UPI deep link & QR Code
  const upiPayLink = `upi://pay?pa=${DEFAULT_UPI_ID}&pn=Sangeet%20Sarathi&am=${totalFee}&cu=INR&tn=Trinity%20Exam%20Enrollment`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(upiPayLink)}`;

  // Pre-populated WhatsApp Send Link
  // User format: "I have submitted form for (Candidates name) and (Grade) , total : (total fee)"
  const getWhatsAppLink = () => {
    let msg = "";
    if (candidates.length === 1) {
      const c = candidates[0];
      const name = `${toTitleCase(c.firstName)} ${toTitleCase(c.lastName)}`.trim();
      msg = `I have submitted form for ${name} and ${c.grade} , total : ₹${totalFee.toLocaleString("en-IN")}`;
    } else {
      const list = candidates
        .map(c => `${toTitleCase(c.firstName)} ${toTitleCase(c.lastName)} and ${c.grade}`)
        .join(", ");
      msg = `I have submitted form for ${list} , total : ₹${totalFee.toLocaleString("en-IN")}`;
    }

    return `https://wa.me/91${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  // STEP 1: Triggered when user clicks "Review & Submit Entries"
  // Opens the pop-up modal so the user can verify entries before actual submission
  const handleOpenReviewModal = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validation: Section 1 Candidates
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c.firstName.trim()) {
        setErrorMsg(`Please enter First Name for Candidate #${i + 1}.`);
        return;
      }
      if (!c.lastName.trim()) {
        setErrorMsg(`Please enter Middle & Last Name for Candidate #${i + 1}.`);
        return;
      }

      // DOB validation (1940 to current year)
      const dobVal = validateDob(c.dob);
      if (!dobVal.valid) {
        setErrorMsg(`Candidate #${i + 1} (${c.firstName || "Student"}): ${dobVal.error}`);
        return;
      }

      // Mandatory School Name unless "No Music School" is clicked
      if (!c.hasNoSchool && !c.schoolName.trim()) {
        setErrorMsg(`Please enter Music School Name for Candidate #${i + 1} (e.g. National) or click "No Music School".`);
        return;
      }
    }

    // 2. Validation: Section 2 Contact Details
    if (!submitterEmail.trim() || !submitterEmail.includes("@")) {
      setErrorMsg("Please enter a valid Submitter Email Address in Section 2 (Contact Details).");
      return;
    }
    if (!submitterName.trim()) {
      setErrorMsg("Submitter / Applicant Name is required in Section 2.");
      return;
    }
    if (!submitterMobile.trim()) {
      setErrorMsg("WhatsApp / Mobile Number is required in Section 2.");
      return;
    }
    if (!teacherName.trim()) {
      setErrorMsg("Teacher Name is required in Section 2 (Contact Details).");
      return;
    }

    // Normalize casing across all fields before showing review
    setCandidates(prev => prev.map(c => ({
      ...c,
      firstName: toTitleCase(c.firstName),
      lastName: toTitleCase(c.lastName),
      dob: validateDob(c.dob).formatted || c.dob.trim(),
      schoolName: c.hasNoSchool ? "" : toSchoolTitleCase(c.schoolName),
      instrument: c.examSuite === "Rock & Pop" && c.instrument.toLowerCase().includes("drum")
        ? "Drums"
        : (c.examSuite === "Classical & Jazz" && c.instrument.toLowerCase().includes("drum") ? "Drum Kit" : c.instrument)
    })));
    setSubmitterName(toTitleCase(submitterName));
    setTeacherName(toTitleCase(teacherName));
    setSubmitterEmail(submitterEmail.trim());
    setSubmitterMobile(submitterMobile.trim());

    // Open confirmation pop-up modal
    setShowReviewModal(true);
  };

  // STEP 2: Actual Submission from the Confirmation Pop-up Modal
  const handleConfirmSubmit = async () => {
    setShowReviewModal(false);
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/entries/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterEmail,
          submitterName: toTitleCase(submitterName),
          submitterMobile,
          teacherName: toTitleCase(teacherName),
          candidates: candidates.map(c => ({
            firstName: toTitleCase(c.firstName),
            lastName: toTitleCase(c.lastName),
            dob: validateDob(c.dob).formatted || c.dob,
            gender: c.gender,
            examSuite: c.examSuite,
            instrument: c.examSuite === "Rock & Pop" && c.instrument.toLowerCase().includes("drum")
              ? "Drums"
              : (c.examSuite === "Classical & Jazz" && c.instrument.toLowerCase().includes("drum") ? "Drum Kit" : c.instrument),
            grade: c.grade,
            schoolName: c.hasNoSchool ? "" : toSchoolTitleCase(c.schoolName)
          })),
          paymentRefNote: paymentRef
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit enrollment");
      }

      setSubmitSuccess(data);
      setCurrentStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-amber-100 selection:text-amber-900 pb-20">
      {/* Top Header / Branding Banner */}
      <header className="bg-white text-slate-900 border-b border-slate-200/90 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
            {/* Left Section: National Academy of Music Branding */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <img
                src="/images/national-academy-of-music.png"
                alt="National Academy of Music"
                className="h-12 sm:h-14 w-auto object-contain shrink-0"
              />
              <div className="h-10 w-px bg-slate-200 hidden sm:block" />
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Official Portal
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Exam Centre 63868</span>
                </div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 mt-0.5">
                  National Academy of Music
                </h1>
                <p className="text-xs sm:text-sm font-bold text-amber-700">
                  Trinity College of London Digital Exam Enrollment Form
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  Digital Examination Entries
                </p>
              </div>
            </div>

            {/* Right Section: Trinity College London Official Centre Logo */}
            <div className="flex items-center justify-center shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:border-l sm:border-slate-200 sm:pl-6">
              <img
                src="/images/trinity-college-london.png"
                alt="Trinity College London Registered Exam Centre 63868"
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        {/* Step Indicator Tabs */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2 sm:gap-4 bg-white border border-slate-200/90 p-1.5 rounded-2xl shadow-sm text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                if (currentStep === "payment") setCurrentStep("form");
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
                currentStep === "form"
                  ? "bg-slate-900 text-white shadow"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === "form" ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-700"
              }`}>
                1
              </span>
              <span>Candidate & Contact Details</span>
            </button>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

            <div
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all ${
                currentStep === "payment"
                  ? "bg-amber-500 text-slate-950 shadow font-extrabold"
                  : "text-slate-400"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === "payment" ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-500"
              }`}>
                2
              </span>
              <span>Payment Portal & Summary</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: PAYMENT PORTAL (AFTER SUBMITTING)                     */}
        {/* ------------------------------------------------------------- */}
        {currentStep === "payment" ? (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Top Confirmation Banner */}
            <div className="bg-white rounded-3xl shadow-sm border border-emerald-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ring-4 ring-emerald-50">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Entries Recorded Successfully
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Welcome to the Exam Payment Portal
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Your candidates under Teacher <strong className="text-slate-900">{toTitleCase(teacherName)}</strong> are successfully recorded for Digital Examination Entries.
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print Summary
                </button>
              </div>
            </div>

            {/* Excel-Style Candidate Summary Table */}
            <div className="bg-white rounded-3xl shadow-md border border-slate-300 overflow-hidden">
              <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <TableIcon className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-sm sm:text-base text-white tracking-wide">
                    Enrollment Summary Table ({candidates.length} Candidate{candidates.length > 1 ? "s" : ""})
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    Session: December
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 font-semibold">
                    Excel Format
                  </span>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center border-r border-slate-200 w-12">#</th>
                      <th className="py-3 px-4 border-r border-slate-200">Candidate Name</th>
                      <th className="py-3 px-3 border-r border-slate-200">DOB</th>
                      <th className="py-3 px-3 text-center border-r border-slate-200">Gender</th>
                      <th className="py-3 px-4 border-r border-slate-200">Exam Suite</th>
                      <th className="py-3 px-4 border-r border-slate-200">Subject / Instrument</th>
                      <th className="py-3 px-3 border-r border-slate-200">Grade</th>
                      <th className="py-3 px-4 border-r border-slate-200">School on Certificate</th>
                      <th className="py-3 px-4 text-right">Fee (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {candidates.map((c, idx) => {
                      const currentFeeItem = GRADES_WITH_FEES.find(g => g.grade.toLowerCase() === c.grade.toLowerCase());
                      const candFee = currentFeeItem ? currentFeeItem.fee : 6050;
                      const formattedName = `${toTitleCase(c.firstName)} ${toTitleCase(c.lastName)}`;
                      const formattedSchool = c.hasNoSchool || !c.schoolName 
                        ? "None (Independent)" 
                        : toSchoolTitleCase(c.schoolName);
                      const finalInst = c.examSuite === "Rock & Pop" && c.instrument.toLowerCase().includes("drum")
                        ? "Drums"
                        : (c.examSuite === "Classical & Jazz" && c.instrument.toLowerCase().includes("drum") ? "Drum Kit" : c.instrument);

                      return (
                        <tr 
                          key={c.id || idx} 
                          className={idx % 2 === 0 ? "bg-white hover:bg-amber-50/40" : "bg-slate-50/80 hover:bg-amber-50/40"}
                        >
                          <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 border-r border-slate-200">
                            {formattedName}
                          </td>
                          <td className="py-3 px-3 text-slate-700 border-r border-slate-200 font-mono">
                            {c.dob || "01/01/2000"}
                          </td>
                          <td className="py-3 px-3 text-center border-r border-slate-200">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.gender === "F" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {c.gender}
                            </span>
                          </td>
                          <td className="py-3 px-4 border-r border-slate-200">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              c.examSuite === "Rock & Pop" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-900"
                            }`}>
                              {c.examSuite}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 border-r border-slate-200">
                            {finalInst}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 border-r border-slate-200">
                            {c.grade}
                          </td>
                          <td className="py-3 px-4 text-slate-800 border-r border-slate-200">
                            {c.hasNoSchool || !c.schoolName ? (
                              <span className="italic text-slate-400">None (Independent)</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                {formattedSchool.toLowerCase().includes("national") && (
                                  <img
                                    src="/images/national-academy-of-music.png"
                                    alt="National Academy of Music"
                                    className="h-5 sm:h-6 object-contain shrink-0"
                                  />
                                )}
                                <span className="font-semibold text-slate-900">{formattedSchool}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                            ₹{candFee.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <td colSpan={7} className="py-3 px-4 text-slate-700 text-right">
                        Total Candidates: <span className="text-slate-950 font-black">{candidates.length} Student{candidates.length > 1 ? "s" : ""}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-right uppercase text-[11px] tracking-wider">
                        Total Amount Payable:
                      </td>
                      <td className="py-3 px-4 text-right text-base font-black text-amber-600 font-mono">
                        ₹{totalFee.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Submitter & Teacher Summary Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Submitter Email</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate" title={submitterEmail}>{submitterEmail}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Submitter / Applicant</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{toTitleCase(submitterName)}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">WhatsApp / Mobile</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{submitterMobile}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Teacher</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{toTitleCase(teacherName)}</span>
              </div>
            </div>

            {/* UPI & Bank Payment Details Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 p-6 sm:p-8">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Step 1: Complete Payment via UPI or Bank Transfer</h2>
                  <p className="text-xs text-slate-500">
                    Pay using Google Pay, PhonePe, Paytm, BHIM, or Direct Net Banking.
                  </p>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="mt-6 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-slate-950 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-950 bg-amber-300/60 px-2.5 py-0.5 rounded-full">
                      Total Fee Payable
                    </span>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                      ₹{totalFee.toLocaleString("en-IN")}
                    </div>
                    <p className="text-xs text-amber-950/80 mt-1">
                      For {candidates.length} Candidate{candidates.length > 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Mobile Direct Pay Button */}
                  <a
                    href={upiPayLink}
                    className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all text-sm shrink-0 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    Pay ₹{totalFee.toLocaleString("en-IN")} via UPI App
                  </a>
                </div>
              </div>

              {/* QR Code & Copyable Bank / UPI Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 items-center">
                {/* QR Code */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col items-center text-center">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                    <img
                      src={upiQrUrl}
                      alt="UPI QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 mt-3 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-amber-600" />
                    Scan with any UPI App to Pay
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Google Pay • PhonePe • Paytm • BHIM • iMobile</span>
                </div>

                {/* All Copyable Payment Credentials */}
                <div className="space-y-3.5">
                  {/* UPI ID */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">UPI ID / VPA</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-sm text-slate-900 break-all">{DEFAULT_UPI_ID}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(DEFAULT_UPI_ID, "upi")}
                        className="ml-2 inline-flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {copiedKey === "upi" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Account Number */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Bank Account Number</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-sm text-slate-900">{BANK_ACCOUNT_NUMBER}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(BANK_ACCOUNT_NUMBER, "account")}
                        className="ml-2 inline-flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {copiedKey === "account" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* IFSC Code */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">IFSC Code</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-sm text-slate-900">{BANK_IFSC_CODE}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(BANK_IFSC_CODE, "ifsc")}
                        className="ml-2 inline-flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {copiedKey === "ifsc" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Beneficiary Name & Bank */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Beneficiary & Bank</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-xs text-slate-800">{BANK_BENEFICIARY} ({BANK_NAME})</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(BANK_BENEFICIARY, "beneficiary")}
                        className="ml-2 inline-flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {copiedKey === "beneficiary" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Optional UPI Ref Note */}
                  <div>
                    <label htmlFor={`${formId}-payRef`} className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      UPI Reference / UTR Number <span className="text-slate-400 font-normal">(Optional note)</span>
                    </label>
                    <input
                      id={`${formId}-payRef`}
                      type="text"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="e.g. 12-digit UTR Number"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp Verification Banner (Direct Screenshot Send to 6282920294) */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 shadow-md">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                    <Send className="w-3.5 h-3.5 text-emerald-700" />
                    Step 2: Send Payment Screenshot on WhatsApp
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-emerald-950">
                    Send Screenshot to +91 6282920294
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-800 mt-1 max-w-xl">
                    Once payment is done, click below to open WhatsApp. Your student names and grades will be automatically filled in the message — simply attach your payment screenshot in the chat to complete verification!
                  </p>
                </div>

                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all text-sm sm:text-base shrink-0 cursor-pointer"
                >
                  <Phone className="w-5 h-5" />
                  <span>Open WhatsApp (6282920294)</span>
                </a>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep("form")}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
              >
                ← Back to Edit Details
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentStep("form");
                  setSubmitSuccess(null);
                  setCandidates([
                    {
                      id: "c-1",
                      firstName: "",
                      lastName: "",
                      dob: "",
                      gender: "M",
                      examSuite: "Classical & Jazz",
                      instrument: "Electronic Keyboard",
                      grade: "Grade 1",
                      schoolName: "",
                      hasNoSchool: false
                    }
                  ]);
                }}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-4 py-2.5 rounded-xl border border-amber-300 transition-all cursor-pointer"
              >
                + Enroll Another Candidate or Group
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* STEP 1: FORM ENTRY (CANDIDATES FIRST, CONTACT DETAILS SECOND)  */
          /* ------------------------------------------------------------- */
          <form onSubmit={handleOpenReviewModal} className="space-y-8">
            {/* Error Banner */}
            {errorMsg && (
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-2xl flex items-start gap-3 shadow-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">Please Check Your Entries</h4>
                  <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Section 1: Candidate Entries (FIRST SECTION) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Candidate Details ({candidates.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Add candidate(s). Music school name auto-populates for subsequent candidates.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddCandidate}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 px-3.5 py-2 rounded-xl shadow transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Student
                </button>
              </div>

              {candidates.map((cand, index) => {
                const currentFeeItem = GRADES_WITH_FEES.find(g => g.grade.toLowerCase() === cand.grade.toLowerCase());
                const candFee = currentFeeItem ? currentFeeItem.fee : 6050;
                const instrumentsList = cand.examSuite === "Rock & Pop" ? ROCK_POP_INSTRUMENTS : CLASSICAL_INSTRUMENTS;

                return (
                  <div 
                    key={cand.id} 
                    className="bg-white rounded-3xl shadow-sm border border-slate-200/90 p-6 sm:p-8 relative transition-all hover:border-amber-300"
                  >
                    {/* Header bar of candidate card */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">
                          {cand.firstName ? `${cand.firstName} ${cand.lastName}` : `Student #${index + 1} (e.g. John Players)`}
                        </h3>
                        <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 ml-2">
                          Fee: ₹{candFee.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {candidates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCandidate(index)}
                          className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove this candidate"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                      {/* First Name */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Candidate First Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={cand.firstName}
                          onChange={e => updateCandidate(index, "firstName", e.target.value)}
                          placeholder="e.g. John"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                        />
                      </div>

                      {/* Middle & Last Name */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Middle & Last Name / Surname <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={cand.lastName}
                          onChange={e => updateCandidate(index, "lastName", e.target.value)}
                          placeholder="e.g. Players"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                        />
                      </div>

                      {/* Date of Birth */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Date of Birth (DD/MM/YYYY) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            required
                            value={cand.dob}
                            onChange={e => updateCandidate(index, "dob", e.target.value)}
                            placeholder="e.g. 18/06/2011"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all font-mono"
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Format: DD/MM/YYYY (Birth year between 1940 and {new Date().getFullYear()})
                        </span>
                      </div>

                      {/* Gender Selector */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Gender <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => updateCandidate(index, "gender", "M")}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              cand.gender === "M"
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>👦</span> Male (M)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCandidate(index, "gender", "F")}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              cand.gender === "F"
                                ? "bg-pink-600 border-pink-600 text-white shadow-sm"
                                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>👧</span> Female (F)
                          </button>
                        </div>
                      </div>

                      {/* Exam Suite Toggle */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Exam Suite <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => updateCandidate(index, "examSuite", "Classical & Jazz")}
                            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              cand.examSuite === "Classical & Jazz"
                                ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 text-slate-900"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              cand.examSuite === "Classical & Jazz" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-100 text-slate-500"
                            }`}>
                              <Music className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold">Classical & Jazz (Digital)</div>
                              <div className="text-xs text-slate-500 mt-0.5">Piano, Electronic Keyboard, Drum Kit, Acoustic Guitar, Violin</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => updateCandidate(index, "examSuite", "Rock & Pop")}
                            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              cand.examSuite === "Rock & Pop"
                                ? "bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 text-slate-900"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              cand.examSuite === "Rock & Pop" ? "bg-purple-600 text-white font-bold" : "bg-slate-100 text-slate-500"
                            }`}>
                              <Drum className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold">Rock & Pop (Digital)</div>
                              <div className="text-xs text-slate-500 mt-0.5">Drums, Vocals, Electric Guitar, Bass, Keyboards</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Instrument / Subject */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Subject / Instrument <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={cand.instrument}
                          onChange={e => updateCandidate(index, "instrument", e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm bg-white transition-all font-medium"
                        >
                          {instrumentsList.map(inst => (
                            <option key={inst} value={inst}>
                              {inst}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Grade & Fee */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Examination Grade <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={cand.grade}
                          onChange={e => updateCandidate(index, "grade", e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm bg-white transition-all font-medium"
                        >
                          {GRADES_WITH_FEES.map(g => (
                            <option key={g.grade} value={g.grade}>
                              {g.grade} — ₹{g.fee.toLocaleString("en-IN")}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Music School Name for Certificate */}
                      <div className="sm:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                              Music School Name for Certificate <span className="text-rose-500">*</span>
                            </label>
                            {candidates.length > 1 && cand.schoolName && !cand.hasNoSchool && (
                              <button
                                type="button"
                                onClick={() => applySchoolToAll(cand.schoolName)}
                                className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 transition-all cursor-pointer"
                                title="Copy this school name to all other student cards"
                              >
                                ✨ Apply to all
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const next = !cand.hasNoSchool;
                              updateCandidate(index, "hasNoSchool", next);
                              if (next) {
                                updateCandidate(index, "schoolName", "");
                              }
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto ${
                              cand.hasNoSchool
                                ? "bg-slate-900 text-amber-400 border-slate-800 shadow-sm"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                            }`}
                          >
                            {cand.hasNoSchool ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-amber-400" />
                                <span>No Music School Selected</span>
                              </>
                            ) : (
                              <span>No Music School</span>
                            )}
                          </button>
                        </div>

                        {cand.hasNoSchool ? (
                          <div className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs sm:text-sm flex items-center justify-between">
                            <span className="italic">
                              No music school will appear on the certificate (Independent candidate)
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCandidate(index, "hasNoSchool", false)}
                              className="text-xs text-amber-600 font-bold hover:underline cursor-pointer ml-2 shrink-0"
                            >
                              Enter School Name
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                            <input
                              type="text"
                              required={!cand.hasNoSchool}
                              value={cand.schoolName}
                              onChange={e => updateCandidate(index, "schoolName", e.target.value)}
                              placeholder="e.g. National Academy of Music"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                            />
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          {cand.hasNoSchool
                            ? "Certificate will display student name only without any school or academy."
                            : 'Exact music school name to be printed on certificate (e.g. "National Academy of Music"). Auto-populates for next candidates.'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddCandidate}
                className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-3xl bg-slate-50/50 hover:bg-amber-50/40 text-slate-600 hover:text-amber-900 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-5 h-5 text-amber-500" />
                Add Another Candidate (Student)
              </button>
            </div>

            {/* Section 2: Contact Details (Submitter Email, Name, Mobile, Teacher) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Contact & Teacher Details</h2>
                  <p className="text-xs text-slate-500">Submitter and teacher information for official exam communications</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                {/* 1. Submitter Email ID - MANDATORY & FIRST TEXTBOX */}
                <div className="sm:col-span-2">
                  <label htmlFor={`${formId}-subEmail`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Submitter Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id={`${formId}-subEmail`}
                      type="email"
                      required
                      value={submitterEmail}
                      onChange={e => setSubmitterEmail(e.target.value)}
                      placeholder="e.g. name@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Official appointment slip, timetable, and exam confirmations will be sent to this email
                  </span>
                </div>

                {/* 2. Submitter Name - MANDATORY & SECOND TEXTBOX */}
                <div>
                  <label htmlFor={`${formId}-subName`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Submitter / Applicant Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id={`${formId}-subName`}
                      type="text"
                      required
                      value={submitterName}
                      onChange={e => setSubmitterName(e.target.value)}
                      placeholder="e.g. John Adams"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                {/* 3. Submitter Mobile - MANDATORY & THIRD TEXTBOX */}
                <div>
                  <label htmlFor={`${formId}-subPhone`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    WhatsApp / Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id={`${formId}-subPhone`}
                      type="tel"
                      required
                      value={submitterMobile}
                      onChange={e => setSubmitterMobile(e.target.value)}
                      placeholder="e.g. 9847240369"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                {/* 4. Teacher Name - MANDATORY & FOURTH TEXTBOX */}
                <div className="sm:col-span-2">
                  <label htmlFor={`${formId}-teacherName`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Teacher Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id={`${formId}-teacherName`}
                      type="text"
                      required
                      value={teacherName}
                      onChange={e => setTeacherName(e.target.value)}
                      placeholder="e.g. John Adams"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Required for official Trinity College London records
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button to Open Review Pop-up Modal */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-extrabold text-base sm:text-lg py-4 px-8 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Review & Verify Entries ({candidates.length} Student{candidates.length > 1 ? "s" : ""})</span>
                <ChevronRight className="w-5 h-5 text-amber-400" />
              </button>
              <p className="text-center text-xs text-slate-500 mt-2.5">
                Clicking opens a verification window so you can confirm all student names, grades, and certificate schools before submitting to the payment portal.
              </p>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* POP-UP VERIFICATION MODAL BEFORE SUBMITTING                   */}
        {/* ------------------------------------------------------------- */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-300 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Verify Your Enrollment Entries
                    </h3>
                    <p className="text-xs text-slate-300">
                      Please check student names, grades, and certificate schools before final submission
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Contact Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Submitter Email</span>
                    <span className="font-semibold text-slate-900 truncate block mt-0.5" title={submitterEmail}>{submitterEmail}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Submitter Name</span>
                    <span className="font-semibold text-slate-900 truncate block mt-0.5">{toTitleCase(submitterName)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">WhatsApp Phone</span>
                    <span className="font-semibold text-slate-900 block mt-0.5">{submitterMobile}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Teacher</span>
                    <span className="font-semibold text-slate-900 truncate block mt-0.5">{toTitleCase(teacherName)}</span>
                  </div>
                </div>

                {/* Candidate Table in Modal */}
                <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                    <span>Candidates List ({candidates.length} Student{candidates.length > 1 ? "s" : ""})</span>
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Title Case Auto-Formatted
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[360px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3">Candidate Name</th>
                          <th className="py-2.5 px-3">DOB</th>
                          <th className="py-2.5 px-2 text-center">Gender</th>
                          <th className="py-2.5 px-3">Exam Suite</th>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3">Grade</th>
                          <th className="py-2.5 px-3">School on Certificate</th>
                          <th className="py-2.5 px-3 text-right">Fee (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {candidates.map((c, i) => {
                          const currentFeeItem = GRADES_WITH_FEES.find(g => g.grade.toLowerCase() === c.grade.toLowerCase());
                          const candFee = currentFeeItem ? currentFeeItem.fee : 6050;
                          const instName = c.examSuite === "Rock & Pop" && c.instrument.toLowerCase().includes("drum")
                            ? "Drums"
                            : (c.examSuite === "Classical & Jazz" && c.instrument.toLowerCase().includes("drum") ? "Drum Kit" : c.instrument);

                          return (
                            <tr key={c.id || i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-500">{i + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {toTitleCase(c.firstName)} {toTitleCase(c.lastName)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700">{c.dob}</td>
                              <td className="py-2.5 px-2 text-center font-bold text-slate-700">{c.gender}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{c.examSuite}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">{instName}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{c.grade}</td>
                              <td className="py-2.5 px-3 text-slate-800">
                                {c.hasNoSchool || !c.schoolName ? (
                                  <span className="italic text-slate-400">Independent (No School)</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {toSchoolTitleCase(c.schoolName).toLowerCase().includes("national") && (
                                      <img
                                        src="/images/national-academy-of-music.png"
                                        alt="National Academy of Music"
                                        className="h-4 sm:h-5 object-contain shrink-0"
                                      />
                                    )}
                                    <span className="font-semibold text-slate-900">{toSchoolTitleCase(c.schoolName)}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ₹{candFee.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
                        <tr>
                          <td colSpan={7} className="py-3 px-3 text-right text-slate-700">
                            Total Payable:
                          </td>
                          <td colSpan={2} className="py-3 px-3 text-right text-base text-amber-600 font-mono font-black">
                            ₹{totalFee.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Proceed to Payment Portal (₹{totalFee.toLocaleString("en-IN")})</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
