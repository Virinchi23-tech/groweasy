'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

interface LogMessage {
  time: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

function ProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';

  const [status, setStatus] = useState<'PROCESSING' | 'COMPLETED' | 'FAILED'>('PROCESSING');
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [successful, setSuccessful] = useState(0);
  const [failed, setFailed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [duplicate, setDuplicate] = useState(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  useEffect(() => {
    // Scroll logs to bottom
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!id) return;
    addLog('Establishing connection to processing status stream...', 'info');

    let API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    if (API_BASE_URL && !API_BASE_URL.endsWith('/api') && !API_BASE_URL.endsWith('/api/')) {
      API_BASE_URL = `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/api`;
    }

    const es = new EventSource(`${API_BASE_URL}/csv/status/${id}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'CONNECT') {
          addLog('Connected successfully. Commencing AI mapping batches...', 'success');
        } else if (data.type === 'PROGRESS') {
          if (data.status) setStatus(data.status);
          if (data.processed !== undefined) setProcessed(data.processed);
          if (data.total !== undefined) setTotal(data.total);

          if (data.batchIndex !== undefined) {
            addLog(`Completed AI processing batch #${data.batchIndex + 1}`, 'info');
          } else {
            addLog(`Import progress updated: ${data.processed}/${data.total} records mapped`, 'info');
          }
        } else if (data.type === 'COMPLETE') {
          setStatus('COMPLETED');
          if (data.summary) {
            setProcessed(data.summary.processed);
            setTotal(data.summary.total);
            setSuccessful(data.summary.successful);
            setFailed(data.summary.failed);
            setSkipped(data.summary.skipped);
            setDuplicate(data.summary.duplicate);
          }
          addLog('All queue items successfully mapped and imported. Job completed!', 'success');
          es.close();
        } else if (data.type === 'ERROR') {
          addLog(`Error processing batch #${data.batchIndex + 1}: ${data.errorMessage}`, 'error');
        }
      } catch (err) {
        addLog('Failed to parse status update package', 'error');
      }
    };

    es.onerror = () => {
      addLog('Status stream encountered a network error. Attempting reconnect...', 'error');
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [id]);

  const percentage = total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;
  
  // Calculate remaining time
  const remainingRows = total - processed;
  const etaSec = Math.max(Math.ceil((remainingRows / 100) * 1.5), 0);
  const etaText = etaSec > 0 ? `${etaSec}s` : '0s';

  if (!id) {
    return (
      <div className="text-center p-12 space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-red-650">No Import Session ID Provided</h2>
        <button
          onClick={() => router.push('/import')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Processing Leads</h1>
        <p className="text-slate-500 dark:text-slate-400">AI is mapping and formatting columns into GrowEasy CRM database</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-8 shadow-sm space-y-8">
        {/* Progress circular loader */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800" />
            <div 
              className="absolute inset-0 rounded-full border-4 border-emerald-600 dark:border-emerald-500 border-t-transparent border-r-transparent animate-spin"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)' }}
            />
            <span className="text-2xl font-bold text-slate-950 dark:text-white">{percentage}%</span>
          </div>

          <div className="text-center space-y-1">
            <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {status === 'COMPLETED' ? 'Import Complete' : 'AI Processing Active'}
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Processed {processed.toLocaleString()} of {total.toLocaleString()} rows
            </p>
            {status !== 'COMPLETED' && (
              <p className="text-xs text-slate-400">Estimated remaining time: <span className="font-semibold">{etaText}</span></p>
            )}
          </div>
        </div>

        {/* Numeric breakdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Successful</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{successful.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Failed</span>
            <p className="text-xl font-bold text-red-500">{failed.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Duplicate</span>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{duplicate.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Skipped</span>
            <p className="text-xl font-bold text-amber-500">{skipped.toLocaleString()}</p>
          </div>
        </div>

        {/* Live logs terminal console */}
        <div className="space-y-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Live processing log</span>
          <div className="h-48 bg-slate-950 dark:bg-black rounded-2xl p-4 font-mono text-xs overflow-y-auto space-y-2 border border-slate-800">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 leading-relaxed">
                <span className="text-slate-500 shrink-0">{log.time}</span>
                <span className={
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-emerald-400 font-semibold' :
                  'text-slate-300'
                }>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center active:scale-98"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.push(`/import/result?id=${id}`)}
            disabled={status !== 'COMPLETED'}
            className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            Show Results
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProcessPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 w-1/4 rounded-xl" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 w-1/3 rounded-xl" />
        <div className="h-[400px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    }>
      <ProcessContent />
    </Suspense>
  );
}
