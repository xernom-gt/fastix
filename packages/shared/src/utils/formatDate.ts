export function formatTanggalID(isoDate: string): string {
  if (!isoDate) return '-';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffDays(dateA: string, dateB: string = getTodayISO()): number {
  if (!dateA || !dateB) return 0;
  const fromMs = new Date(dateA.slice(0, 10) + 'T00:00:00Z').getTime();
  const toMs = new Date(dateB.slice(0, 10) + 'T00:00:00Z').getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return 0;
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24));
}
