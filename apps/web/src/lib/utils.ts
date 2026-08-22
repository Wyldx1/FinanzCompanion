import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseCurrency(value: string): number | null {
  // Handle various formats: 1.234,56 | 1234.56 | 1234 | 1,2k
  let cleaned = value.trim().toLowerCase();

  // Handle k suffix (1,2k = 1200)
  if (cleaned.endsWith('k')) {
    cleaned = cleaned.slice(0, -1);
    const num = parseFloat(cleaned.replace(',', '.'));
    if (isNaN(num)) return null;
    return Math.round(num * 1000 * 100);
  }

  // German format: 1.234,56 -> 1234.56
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  // Remove currency symbol and whitespace
  cleaned = cleaned.replace(/[€\s]/g, '');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return Math.round(num * 100);
}

export function periodToDate(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function formatPeriod(period: string): string {
  const date = periodToDate(period);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
}
