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
  Upload, 
  AlertCircle, 
  Phone, 
  User, 
  Mail, 
  Building2, 
  GraduationCap, 
  Calendar,
  Sparkles,
  QrCode,
  ChevronRight
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

const CLASSICAL_INSTRUMENTS = [
  "Electronic Keyboard",
  "Piano",
  "Acoustic Guitar",
  "Classical Guitar",
  "Violin",
  "Saxophone",
  "Singing / Vocals",
  "Flute",
  "Cello",
  "Other"
];

const ROCK_POP_INSTRUMENTS = [
  "Drum Kit",
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

const DEFAULT_UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "6282920294@okaxis";
const WHATSAPP_NUMBER = "6282920294";

export default function PublicEnrollPage() {
  const formId = useId();

  // Section 1: Candidates list (First)
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

  // Section 2: Contact & Teacher details (Second - Teacher Name is Mandatory)
  const [teacherName, setTeacherName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterMobile, setSubmitterMobile] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  // Section 3: Payment states
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);

  // Compute total fee
  const totalFee = candidates.reduce((sum, c) => {
    const item = GRADES_WITH_FEES.find(g => g.grade.toLowerCase() === c.grade.toLowerCase());
    return sum + (item ? item.fee : 6050);
  }, 0);

  // Add Candidate
  const handleAddCandidate = () => {
    // Inherit the school name from the previous candidate if already entered
    const lastCand = candidates[candidates.length - 1];
    const prevSchool = lastCand && !lastCand.hasNoSchool ? lastCand.schoolName : "";

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
        schoolName: prevSchool,
        hasNoSchool: false
      }
    ]);
  };

  // Remove Candidate
  const handleRemoveCandidate = (index: number) => {
    if (candidates.length <= 1) return;
    setCandidates(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update candidate field
  const updateCandidate = (index: number, field: keyof CandidateForm, value: any) => {
    setCandidates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If suite changed, make sure instrument fits
      if (field === "examSuite") {
        if (value === "Rock & Pop" && !ROCK_POP_INSTRUMENTS.includes(updated[index].instrument)) {
          updated[index].instrument = "Drum Kit";
        } else if (value === "Classical & Jazz" && !CLASSICAL_INSTRUMENTS.includes(updated[index].instrument)) {
          updated[index].instrument = "Electronic Keyboard";
        }
      }

      return updated;
    });
  };

  // Handle Screenshot Upload
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Copy UPI ID
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(DEFAULT_UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // UPI deep link
  const upiPayLink = `upi://pay?pa=${DEFAULT_UPI_ID}&pn=Trinity%20Kochi%20Exam%20Center&am=${totalFee}&cu=INR&tn=Trinity%20Exam%20Enrollment`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(upiPayLink)}`;

  // WhatsApp Send Link
  const getWhatsAppLink = () => {
    const candidateSummary = candidates.map((c, i) => {
      const sch = c.hasNoSchool || !c.schoolName ? "No School" : c.schoolName;
      return `${i + 1}. ${c.firstName} ${c.lastName} (${c.grade} ${c.instrument} - ${c.examSuite}) [School: ${sch}]`;
    }).join("%0A");

    const msg = `Hello Trinity Exam Centre,%0A%0AI have submitted exam entries on the enrollment portal:%0A%0A*Teacher Name:* ${encodeURIComponent(teacherName)}%0A*School/Academy:* ${encodeURIComponent(schoolName || "Independent")}%0A*Submitter:* ${encodeURIComponent(submitterName)}%0A*Phone:* ${encodeURIComponent(submitterMobile)}%0A*Total Candidates:* ${candidates.length}%0A*Total Fee:* ₹${totalFee.toLocaleString("en-IN")}%0A*Payment Note/Ref:* ${encodeURIComponent(paymentRef || "UPI Payment")}%0A%0A*Candidates:*%0A${candidateSummary}%0A%0AAttaching payment screenshot here for verification.`;
    return `https://wa.me/91${WHATSAPP_NUMBER}?text=${msg}`;
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation: Section 1 Candidates
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c.firstName.trim()) {
        setErrorMsg(`Please enter First Name for Candidate #${i + 1}.`);
        return;
      }
      if (!c.lastName.trim()) {
        setErrorMsg(`Please enter Last Name for Candidate #${i + 1}.`);
        return;
      }
      if (!c.dob.trim()) {
        setErrorMsg(`Please enter Date of Birth (DD/MM/YYYY) for Candidate #${i + 1}.`);
        return;
      }
      // Mandatory School Name unless "No Music School" is selected
      if (!c.hasNoSchool && !c.schoolName.trim()) {
        setErrorMsg(`Please enter Music School Name for Candidate #${i + 1} (e.g. National) or click "No Music School".`);
        return;
      }
    }

    // Validation: Section 2 Contact & Teacher Details (Teacher Name is Mandatory)
    if (!teacherName.trim()) {
      setErrorMsg("Teacher Name is required in Section 2 (Contact Details).");
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

    setSubmitting(true);

    try {
      const res = await fetch("/api/entries/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName,
          schoolName,
          submitterName,
          submitterMobile,
          submitterEmail,
          candidates: candidates.map(c => ({
            firstName: c.firstName,
            lastName: c.lastName,
            dob: c.dob,
            gender: c.gender,
            examSuite: c.examSuite,
            instrument: c.instrument,
            grade: c.grade,
            schoolName: c.hasNoSchool ? "" : c.schoolName.trim()
          })),
          paymentScreenshotBase64: paymentScreenshot,
          paymentScreenshotFileName: screenshotName,
          paymentRefNote: paymentRef
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit enrollment");
      }

      setSubmitSuccess(data);
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
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-md ring-4 ring-white/10 shrink-0">
              T
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Official Portal
                </span>
                <span className="text-xs text-slate-400">Centre 4048 (Kochi)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
                Trinity College London Exam Enrollment
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Digital Examination Entries & Direct UPI Verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Direct Google Sheet Sync</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        {/* Success Screen */}
        {submitSuccess ? (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full border border-emerald-200 mb-2">
              Enrollment Successful
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Exam Entries Recorded!
            </h2>
            <p className="text-slate-600 max-w-lg mx-auto mt-2 text-sm sm:text-base">
              Thank you, <strong className="text-slate-800">{submitterName}</strong>. Candidate details under Teacher <strong className="text-slate-800">{teacherName}</strong> have been successfully written to the Trinity Master Google Sheet and database.
            </p>

            {/* Quick Summary Card */}
            <div className="my-8 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-lg mx-auto">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Teacher</span>
                <span className="text-sm font-bold text-slate-900">{teacherName}</span>
              </div>
              {schoolName && (
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">School / Academy</span>
                  <span className="text-sm font-semibold text-slate-800">{schoolName}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Candidates</span>
                <span className="text-base font-bold text-slate-900">{submitSuccess.summary?.totalCandidates || candidates.length} Student(s)</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Fees</span>
                <span className="text-lg font-black text-amber-600">₹{submitSuccess.summary?.totalFee?.toLocaleString("en-IN") || totalFee.toLocaleString("en-IN")}</span>
              </div>
              <div className="pt-3 text-xs text-slate-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Entries are highlighted in <strong>Yellow</strong> on the Master Sheet for verification.</span>
              </div>
            </div>

            {/* WhatsApp Action Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300/80 rounded-2xl p-6 max-w-lg mx-auto mb-8 shadow-sm">
              <h3 className="text-base font-bold text-emerald-950 flex items-center justify-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                Step 2: Send Payment Screenshot on WhatsApp
              </h3>
              <p className="text-xs text-emerald-800 mt-1.5 leading-relaxed">
                Click the button below to send your payment screenshot directly to our verification team at <strong>+91 6282920294</strong>.
              </p>

              <a
                href={submitSuccess.summary?.whatsappUrl || getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-sm sm:text-base cursor-pointer"
              >
                <Phone className="w-5 h-5" />
                Open WhatsApp (+91 6282920294)
              </a>
            </div>

            <button
              onClick={() => {
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
                setPaymentScreenshot(null);
                setScreenshotName(null);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Fill another entry form
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
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
                      Add candidate(s). Music school name for certificate is required per student (or select No Music School).
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
                          {cand.firstName ? `${cand.firstName} ${cand.lastName}` : `Student #${index + 1}`}
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
                          placeholder="e.g. Thejus V or Parthiv"
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
                          placeholder="e.g. Nair or Pradeep"
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
                            placeholder="e.g. 28/05/2010"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                          />
                        </div>
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
                              <div className="text-xs text-slate-500 mt-0.5">Piano, Electronic Keyboard, Acoustic Guitar, Violin</div>
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
                              <div className="text-xs text-slate-500 mt-0.5">Drum Kit, Vocals, Electric Guitar, Bass, Keyboards</div>
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

                      {/* Music School Name for Certificate (Mandatory unless "No Music School" is clicked) */}
                      <div className="sm:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Music School Name for Certificate <span className="text-rose-500">*</span>
                          </label>
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
                              placeholder="e.g. National"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                            />
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          {cand.hasNoSchool
                            ? "Certificate will display student name only without any school or academy."
                            : 'Exact music school name to be printed on certificate (e.g. "National"). Click "No Music School" if not applicable.'}
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

            {/* Section 2: Contact & Teacher Details (SECOND SECTION - Teacher Name is Mandatory) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Contact & Teacher Details</h2>
                  <p className="text-xs text-slate-500">Teacher and Submitter (Parent / Teacher / Academy) information</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                {/* Teacher Name - MANDATORY */}
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
                      placeholder="e.g. Kevin James or Sasikumar"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Required for official Trinity College London records
                  </span>
                </div>

                {/* Submitter Name */}
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
                      placeholder="e.g. Parent, Teacher, or Student Name"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Submitter Mobile */}
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Submitter Email */}
                <div>
                  <label htmlFor={`${formId}-subEmail`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Email Address <span className="text-slate-400 font-normal">(Optional - for exam confirmations)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id={`${formId}-subEmail`}
                      type="email"
                      value={submitterEmail}
                      onChange={e => setSubmitterEmail(e.target.value)}
                      placeholder="e.g. zimbelsmusic@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Music School / Academy */}
                <div>
                  <label htmlFor={`${formId}-school`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    General Music School / Academy <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id={`${formId}-school`}
                      type="text"
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="e.g. National"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: UPI Payment & Fee Summary (THIRD SECTION) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow">
                  3
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Payment via UPI</h2>
                  <p className="text-xs text-slate-500">Pay directly using any UPI app (GPay, PhonePe, Paytm, BHIM) and upload screenshot</p>
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
                      Total {candidates.length} candidate(s): {candidates.filter(c => c.examSuite === "Classical & Jazz").length} Classical & Jazz, {candidates.filter(c => c.examSuite === "Rock & Pop").length} Rock & Pop
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

              {/* QR Code & Copy UPI Grid */}
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
                  <span className="text-[11px] text-slate-500 mt-0.5">Google Pay • PhonePe • Paytm • BHIM</span>
                </div>

                {/* UPI Details & Copy */}
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">UPI ID / VPA</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-sm text-slate-900 break-all">{DEFAULT_UPI_ID}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="ml-2 inline-flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {copiedUpi ? (
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

                  {/* Payment Reference Note */}
                  <div>
                    <label htmlFor={`${formId}-payRef`} className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      UPI Reference / UTR Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id={`${formId}-payRef`}
                      type="text"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="e.g. UPI Ref / Transaction ID"
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Screenshot Upload */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Upload Payment Screenshot <span className="text-rose-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-4 text-center bg-slate-50 hover:bg-amber-50/20 transition-all cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {paymentScreenshot ? (
                        <div className="flex items-center justify-center gap-3">
                          <img
                            src={paymentScreenshot}
                            alt="Screenshot preview"
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                          />
                          <div className="text-left">
                            <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]">
                              {screenshotName || "Screenshot Uploaded"}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ready to submit
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-xs font-bold text-slate-700">Click to select screenshot</span>
                          <span className="text-[11px] text-slate-500">PNG, JPG, or screenshot from phone</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct WhatsApp Action Banner */}
              <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Send Screenshot to WhatsApp</h4>
                    <p className="text-[11px] text-emerald-800">
                      You can also share your payment proof directly to <strong>6282920294</strong>
                    </p>
                  </div>
                </div>

                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  WhatsApp 6282920294
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-base sm:text-lg py-4 px-8 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting & Syncing with Google Sheets...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Exam Enrollment ({candidates.length} Student{candidates.length > 1 ? "s" : ""})</span>
                    <ChevronRight className="w-5 h-5 text-amber-400" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-500 mt-2.5">
                Entries are instantly recorded in the Trinity Master Google Sheet (highlighted in yellow) & database.
              </p>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
