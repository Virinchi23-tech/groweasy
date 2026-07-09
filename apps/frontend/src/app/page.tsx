'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import Link from 'next/link';
import { 
  ArrowUpTrayIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  CircleStackIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ImportJob {
  id: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  duplicateRows: number;
  status: string;
  createdAt: string;
  user: { name: string };
}

export default function DashboardPage() {
  // Query import history
  const { data: history = [], isLoading, refetch } = useQuery<ImportJob[]>({
    queryKey: ['imports-history'],
    queryFn: () => apiFetch('/csv/history'),
    refetchInterval: 5000, // Poll every 5 seconds for status changes
  });

  // Calculate statistics
  const totalImportsCount = history.length;
  
  let totalRowsImported = 0;
  let successfulRows = 0;
  let failedRows = 0;
  let skippedRows = 0;
  let duplicateRows = 0;
  let activeQueueJobs = 0;

  history.forEach((job) => {
    totalRowsImported += job.totalRows;
    successfulRows += job.successfulRows;
    failedRows += job.failedRows;
    skippedRows += job.skippedRows;
    duplicateRows += job.duplicateRows;
    if (job.status === 'PROCESSING' || job.status === 'PENDING') {
      activeQueueJobs++;
    }
  });

  const processedCount = successfulRows + failedRows + skippedRows + duplicateRows;
  const successRate = processedCount > 0 
    ? Math.round((successfulRows / (successfulRows + failedRows + duplicateRows)) * 100) 
    : 0;

  const stats = [
    {
      name: 'Total Leads Imported',
      value: successfulRows.toLocaleString(),
      icon: CircleStackIcon,
      color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20'
    },
    {
      name: 'Import Success Rate',
      value: `${successRate}%`,
      icon: CheckCircleIcon,
      color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20'
    },
    {
      name: 'Failed / Skipped Rows',
      value: (failedRows + skippedRows).toLocaleString(),
      icon: ExclamationTriangleIcon,
      color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20'
    },
    {
      name: 'Active Import Jobs',
      value: activeQueueJobs.toString(),
      icon: ArrowPathIcon,
      color: activeQueueJobs > 0 
        ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 animate-spin-slow' 
        : 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/40'
    }
  ];

  const getStatusBadge = (status: string, processed: number, total: number) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400">Completed</span>;
      case 'PROCESSING':
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping" />
            Processing ({pct}%)
          </span>
        );
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400">In Queue</span>;
      case 'FAILED':
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400">Failed</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">GrowEasy Importer</h1>
          <p className="text-slate-500 dark:text-slate-400">Upload and intelligently map CSV files into CRM leads using AI</p>
        </div>
        <Link
          href="/import"
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all self-start md:self-auto"
        >
          <ArrowUpTrayIcon className="w-5 h-5" />
          Import New CSV
        </Link>
      </div>

      {/* Metrics widgets */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-3xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</span>
                <p className="text-3xl font-bold text-slate-950 dark:text-white">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-2xl ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Imports History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">Recent Imports</h2>
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ClockIcon className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 rounded-2xl mx-auto border border-slate-200 dark:border-slate-800">
              <ArrowUpTrayIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No imports yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Upload your first leads spreadsheet to get started</p>
            </div>
            <Link
              href="/import"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition-all"
            >
              Upload CSV
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">File Name</th>
                  <th className="px-6 py-4">Upload Date</th>
                  <th className="px-6 py-4 text-center">Row Count</th>
                  <th className="px-6 py-4 text-center">Success Rate</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                {history.map((job) => {
                  const jobProcessed = job.successfulRows + job.failedRows + job.duplicateRows;
                  const rate = jobProcessed > 0 ? Math.round((job.successfulRows / jobProcessed) * 100) : 0;
                  const uploadDate = new Date(job.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  let actionUrl = `/import/result/${job.id}`;
                  if (job.status === 'PROCESSING' || job.status === 'PENDING') {
                    actionUrl = `/import/process/${job.id}`;
                  }

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors text-sm text-slate-700 dark:text-slate-350">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                        {job.fileName}
                      </td>
                      <td className="px-6 py-4">{uploadDate}</td>
                      <td className="px-6 py-4 text-center font-medium">{job.totalRows.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        {job.status === 'COMPLETED' ? (
                          <span className={`font-semibold ${rate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {rate}%
                          </span>
                        ) : job.status === 'FAILED' ? (
                          <span className="text-red-500 font-semibold">0%</span>
                        ) : (
                          <span className="text-slate-400 font-medium">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(job.status, job.processedRows, job.totalRows)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={actionUrl}
                          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:border-emerald-600 dark:border-slate-800 dark:hover:border-emerald-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 dark:hover:text-emerald-400 hover:text-emerald-600 transition-all active:scale-95"
                        >
                          {job.status === 'PROCESSING' || job.status === 'PENDING' ? 'View Live' : 'View Results'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
