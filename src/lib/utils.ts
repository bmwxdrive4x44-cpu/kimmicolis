import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a number that may use a comma as decimal separator (FR locale).
 * "2,5" → 2.5   "2.5" → 2.5   "NaN" → NaN
 */
export function parseLocaleFloat(value: string | number | undefined | null): number {
  if (typeof value === 'number') return value;
  if (value == null || value === '') return NaN;
  return parseFloat(String(value).replace(',', '.'));
}
