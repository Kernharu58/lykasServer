import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel',
  isDestructive = true, isLoading = false, onConfirm, onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDestructive ? 'bg-rose-100' : 'bg-emerald-100'}`}>
              {isDestructive
                ? <AlertTriangle className="text-rose-600 w-5 h-5" />
                : <CheckCircle2  className="text-emerald-600 w-5 h-5" />
              }
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2.5 text-white rounded-xl font-semibold transition-colors text-sm shadow-sm disabled:opacity-50 ${isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
