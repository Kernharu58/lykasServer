import React from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col justify-center items-center py-20 w-full">
      <div className="relative w-10 h-10 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
      </div>
      <p className="text-slate-500 font-medium text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 text-center flex flex-col items-center w-full my-8">
      <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-rose-500" />
      </div>
      <h3 className="text-base font-bold text-rose-800 mb-1">{title}</h3>
      <p className="text-rose-600 max-w-md text-sm mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-rose-700 transition-colors"
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "No Data Found", message, icon }: { title?: string; message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center items-center py-16 text-center px-4 w-full border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/40 my-2">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
        {icon || <Inbox size={28} />}
      </div>
      <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
      <p className="text-slate-500 max-w-sm text-sm">{message}</p>
    </div>
  );
}
