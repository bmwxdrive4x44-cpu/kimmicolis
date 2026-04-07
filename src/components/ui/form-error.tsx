import { AlertCircle } from 'lucide-react';

type FormErrorProps = {
  message?: string | null;
  className?: string;
};

export function FormFieldError({ message, className = '' }: FormErrorProps) {
  if (!message) return null;

  return (
    <div className={`flex items-center gap-1 text-xs text-red-600 dark:text-red-400 ${className}`.trim()}>
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function FormGlobalError({ message, className = '' }: FormErrorProps) {
  if (!message) return null;

  return (
    <div className={`flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 ${className}`.trim()}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
