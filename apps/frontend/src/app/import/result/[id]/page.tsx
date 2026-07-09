'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../utils/api';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

interface FailedRecord {
  id: string;
  rowIndex: number;
  errorMessage: string;
  rawRow: string;
}

interface DuplicateRecord {
  id: string;
  rowIndex: number;
  lead: { name: string; email: string; mobileWithoutCountryCode: string };
  rawRow: string;
}

interface ImportJobDetail {
  id: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  duplicateRows: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  failedImports: FailedRecord[];
  duplicateLeads: DuplicateRecord[];
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();

  const { data: job, isLoading, error } = useQuery<ImportJobDetail>({
    queryKey: ['import-result', id],
    queryFn: () => apiFetch(`/csv/result/${id}`),
  });

  const handleDownloadErrors = () => {
    if (!job) return;
    downloadFile(`/csv/download-errors/${id}`, `import_errors_${job.fileName}`);
  };

  const handleDownloadSuccess = () => {
    if (!job) return;
    downloadFile(`/csv/download-result/${id}`, `imported_leads_${job.fileName}`);
  };

  const handleExportJSON = async () => {
    if (!job) return;
    try {
      // Fetch successful leads as CSV/JSON or construct it
      const blob = await apiFetch(`/csv/download-result/${id}`);
      // Parse CSV or simply trigger standard json download via api endpoint if we had one.
      // Since download-result endpoint returns CSV, we can download it as CSV.
      // To export as JSON, we can fetch the leads for this import job from leads API.
      const response = await apiFetch(`/leads?importId=${id}&limit=100000`);
      const leads = response.leads || [];
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(leads, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href",     dataStr);
      downloadAnchor.setAttribute("download", `imported_leads_${id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert(`JSON export failed: ${err.message}`);
    }
  };

  const downloadFile = async (endpoint: string, filename: string) => {
    try {
      const blob = await apiFetch(endpoint);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 w-1/4 rounded-xl" />
        <div className="h-[300px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center p-12 space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-red-600">Failed to load results</h2>
        <p className="text-sm text-slate-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const successPercentage = job.totalRows > 0 ? Math.round((job.successfulRows / job.totalRows) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Import Summary</h1>
          <p className="text-slate-500 dark:text-slate-400">Results breakdown for {job.fileName}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 font-semibold transition-all active:scale-98"
        >
          <HomeIcon className="w-5 h-5" />
          Dashboard
        </button>
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-8 shadow-sm space-y-8">
        {/* Success circle */}
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircleIcon className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Import Finished Successfully!</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Successfully imported <span className="font-bold text-emerald-600 dark:text-emerald-400">{job.successfulRows}</span> leads out of <span className="font-semibold">{job.totalRows}</span> total records.
          </p>
        </div>

        {/* Counts display grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 dark:bg-slate-950/30 p-6 rounded-2xl border border-slate-150 dark:border-slate-850">
          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Success Rate</span>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{successPercentage}%</p>
          </div>
          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Failed</span>
            <p className="text-3xl font-extrabold text-red-500">{job.failedRows}</p>
          </div>
          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duplicates</span>
            <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{job.duplicateRows}</p>
          </div>
          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Skipped</span>
            <p className="text-3xl font-extrabold text-amber-500">{job.skippedRows}</p>
          </div>
        </div>

        {/* Download & export actions bar */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Export options</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={handleDownloadSuccess}
              disabled={job.successfulRows === 0}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <DocumentArrowDownIcon className="w-5 h-5" />
              Download Leads CSV
            </button>
            <button
              onClick={handleDownloadErrors}
              disabled={job.failedRows === 0 && job.skippedRows === 0}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              Download Errors CSV
            </button>
            <button
              onClick={handleExportJSON}
              disabled={job.successfulRows === 0}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export JSON Leads
            </button>
          </div>
        </div>

        {/* Failed Rows / Validation Errors preview */}
        {job.failedImports.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Errors Preview (First 5 records)</h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
              {job.failedImports.slice(0, 5).map((failed, i) => (
                <div key={failed.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-slate-50/50 dark:bg-slate-950/20 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-500 dark:text-slate-400">Row #{failed.rowIndex}</span>
                    <p className="font-semibold text-red-600 dark:text-red-400">{failed.errorMessage}</p>
                  </div>
                  <pre className="p-2 rounded bg-slate-100 dark:bg-black max-w-md overflow-x-auto text-[10px] text-slate-600 dark:text-slate-400 truncate">
                    {failed.rawRow}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
