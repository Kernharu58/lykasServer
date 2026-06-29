import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export function ModalShell({
  children,
  maxWidth = 'max-w-2xl',
}: {
  children: ReactNode,
  maxWidth?: string,
}) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className={`bg-white rounded-2xl w-full ${maxWidth} shadow-2xl flex flex-col max-h-[90vh] overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string,
  subtitle?: string,
  onClose: () => void,
}) {
  return (
    <div className="flex justify-between items-start gap-4 p-5 border-b border-slate-100 bg-white flex-shrink-0">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close modal"
        className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-3 p-5 border-t border-slate-100 bg-white flex-shrink-0">{children}</div>;
}

export function FormSection({
  title,
  description,
  children,
}: {
  title?: string,
  description?: string,
  children: ReactNode,
}) {
  return (
    <section className="space-y-5">
      {title ? (
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {description ? <p className="text-xs text-slate-500 mt-1">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FieldGrid({ children, columns = 2 }: { children: ReactNode, columns?: 1 | 2 }) {
  return (
    <div className={`grid grid-cols-1 ${columns === 2 ? 'md:grid-cols-2' : ''} gap-5`}>
      {children}
    </div>
  );
}

export function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string,
  hint?: string,
  required?: boolean,
  children: ReactNode,
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500 mt-1.5">{hint}</p> : null}
    </div>
  );
}

const baseFieldClasses =
  'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${baseFieldClasses} ${className}`.trim()} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select {...rest} className={`${baseFieldClasses} ${className}`.trim()}>
      {children}
    </select>
  );
}

export function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea {...rest} className={`${baseFieldClasses} resize-none ${className}`.trim()} />;
}

export function FormActions({
  onCancel,
  submitLabel,
  loadingLabel,
  loading,
}: {
  onCancel: () => void,
  submitLabel: string,
  loadingLabel: string,
  loading: boolean,
}) {
  return (
    <>
      <button type="button" onClick={onCancel} className="px-5 py-2.5 text-slate-700 font-medium hover:bg-slate-100 rounded-xl transition-colors">
        Cancel
      </button>
      <button type="submit" disabled={loading} className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">
        {loading ? loadingLabel : submitLabel}
      </button>
    </>
  );
}
