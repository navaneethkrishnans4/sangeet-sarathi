"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, RefreshCw, Table as TableIcon } from "lucide-react";

const TABLES = ["Candidate", "TeacherAcademy", "BankTransaction", "TempBankTransaction", "NotYetPaid"];

export default function DatabaseViewerPage() {
  const [activeTable, setActiveTable] = useState(TABLES[0]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (table: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/database?table=${table}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        console.error(json.error);
        setData([]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData(activeTable);
  }, [activeTable]);

  const renderTableData = () => {
    if (loading) {
      return <div className="p-12 text-center text-slate-500">Loading data...</div>;
    }
    if (data.length === 0) {
      return <div className="p-12 text-center text-slate-500">No records found in {activeTable}.</div>;
    }

    const columns = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
              {columns.map(col => (
                <th key={col} className="p-3 font-semibold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-800/50 transition-colors text-sm">
                {columns.map(col => (
                  <td key={col} className="p-3 text-slate-300">
                    {row[col] === null ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : typeof row[col] === 'object' ? (
                      JSON.stringify(row[col])
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans flex flex-col h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/trinityentries" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            Database Viewer
          </h1>
        </div>
        <button 
          onClick={() => fetchData(activeTable)}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2">
          {TABLES.map(table => (
            <button
              key={table}
              onClick={() => setActiveTable(table)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                activeTable === table 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              {table}
            </button>
          ))}
        </div>

        {/* Data View */}
        <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-slate-900 border-b border-slate-800 p-4">
            <h2 className="font-semibold text-slate-300">
              Showing top 100 records for <span className="text-indigo-400">{activeTable}</span>
            </h2>
          </div>
          <div className="flex-1 overflow-auto bg-slate-950">
            {renderTableData()}
          </div>
        </div>
      </div>
    </div>
  );
}
