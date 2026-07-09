'use client';

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/api';
import { 
  ArrowUpTrayIcon, 
  DocumentIcon, 
  XMarkIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    setError(null);
    const selected = acceptedFiles[0];
    if (selected) {
      if (selected.type !== 'text/csv' && !selected.name.endsWith('.csv')) {
        setError('Invalid file type. Only CSV files (.csv) are supported.');
        return;
      }
      setFile(selected);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    accept: {
      'text/csv': ['.csv']
    }
  });

  const handleCancel = () => {
    setFile(null);
    setError(null);
    setUploading(false);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(20);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress(50);
      const response = await apiFetch('/csv/upload', {
        method: 'POST',
        body: formData,
      });

      setProgress(100);
      router.push(`/import/preview?id=${response.importId}`);
    } catch (err: any) {
      setError(err.message || 'File upload and parsing failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Import Leads</h1>
        <p className="text-slate-500 dark:text-slate-400">Upload any CRM spreadsheet. Our AI will automatically parse and map columns</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-8 shadow-sm space-y-6">
        {error && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-medium">
            <ExclamationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!file && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-emerald-600 bg-emerald-50/30 dark:border-emerald-500 dark:bg-emerald-950/10'
                : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="w-14 h-14 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                <ArrowUpTrayIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-880 dark:text-slate-200">
                  {isDragActive ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Or <span className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">browse files</span> from your computer
                </p>
              </div>
              <p className="text-xs text-slate-400">Supported formats: CSV files up to 50MB</p>
            </div>
          </div>
        )}

        {file && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <DocumentIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-850 dark:text-slate-200 truncate max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {uploading && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>Uploading & parsing spreadsheet...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center active:scale-98"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
            disabled={!file || uploading}
          >
            Upload File
          </button>
        </div>
      </div>
    </div>
  );
}
