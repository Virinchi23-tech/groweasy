'use client';

import React, { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../../utils/api';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import {
  ArrowLeftIcon,
  CheckIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface PreviewResponse {
  importId: string;
  fileName: string;
  totalRows: number;
  headers: string[];
  preview: any[];
}

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Fetch preview data
  const { data: previewData, isLoading, error } = useQuery<PreviewResponse>({
    queryKey: ['import-preview', id],
    queryFn: () => apiFetch(`/csv/status/${id}`),
    enabled: !!id,
  });

  const headers = previewData?.headers || [];
  const rows = previewData?.preview || [];
  const totalRows = previewData?.totalRows || 0;

  // Build columns dynamically for TanStack Table
  const columnHelper = createColumnHelper<any>();
  const columns = headers.map((header) =>
    columnHelper.accessor((row) => row[header], {
      id: header,
      header: () => (
        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{header}</span>
      ),
      cell: (info) => (
        <span className="truncate max-w-[200px] block text-slate-600 dark:text-slate-400">
          {String(info.getValue() || '')}
        </span>
      ),
    })
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      globalFilter: searchQuery,
    },
    onGlobalFilterChange: setSearchQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await apiFetch('/csv/confirm', {
        method: 'POST',
        body: JSON.stringify({ importId: id }),
      });
      router.push(`/import/process?id=${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to confirm import');
      setConfirming(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-6xl mx-auto">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 w-1/4 rounded-xl" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 w-1/3 rounded-xl" />
        <div className="h-[400px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (error || !previewData) {
    return (
      <div className="text-center p-12 space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-red-650">Failed to load preview</h2>
        <p className="text-sm text-slate-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button
          onClick={() => router.push('/import')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Cost & Time Estimates
  const estimatedCost = (totalRows * 0.0001).toFixed(2);
  const estimatedTimeSec = Math.ceil((totalRows / 100) * 1.5);
  const estimatedTime = estimatedTimeSec > 60
    ? `${Math.floor(estimatedTimeSec / 60)}m ${estimatedTimeSec % 60}s`
    : `${estimatedTimeSec}s`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={() => router.push('/import')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Back to Upload
          </button>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white truncate max-w-lg">
            Preview: {previewData.fileName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Previewing first 10 rows. Total rows: <span className="font-semibold">{totalRows.toLocaleString()}</span>, Columns: <span className="font-semibold">{headers.length}</span>
          </p>
        </div>

        <button
          onClick={() => setConfirmOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all"
        >
          Confirm & Import
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Table search & controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-3xl shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search preview rows..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* TanStack Table Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-6 py-4 w-[220px]">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-850/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-3.5 truncate">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Import dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleUp space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Confirm CSV Import</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You are about to process this spreadsheet with our AI mapping engine.
              </p>
            </div>

            {/* Estimates box */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 divide-y divide-slate-200 dark:divide-slate-800 space-y-3">
              <div className="flex justify-between items-center text-sm pt-0">
                <span className="text-slate-500 dark:text-slate-400">Total Rows</span>
                <span className="font-semibold text-slate-900 dark:text-white">{totalRows.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3">
                <span className="text-slate-500 dark:text-slate-400">Total Columns</span>
                <span className="font-semibold text-slate-900 dark:text-white">{headers.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3">
                <span className="text-slate-500 dark:text-slate-400">Estimated AI Cost</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">${estimatedCost}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3">
                <span className="text-slate-500 dark:text-slate-400">Estimated Time</span>
                <span className="font-semibold text-slate-900 dark:text-white">{estimatedTime}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-98"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                disabled={confirming}
              >
                {confirming ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirm Import'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse max-w-6xl mx-auto">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 w-1/4 rounded-xl" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 w-1/3 rounded-xl" />
        <div className="h-[400px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
