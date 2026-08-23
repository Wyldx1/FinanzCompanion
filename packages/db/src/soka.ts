export interface WorkTimeStats {
  netMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
}

function getISOWeek(date: Date): number {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Liefert die Soll-Arbeitszeit in Minuten für ein Datum.
 * SOKA-DACH:
 * - Sommerarbeitszeit (KW 18 bis KW 48): 40h/Woche = 8h/Tag
 * - Winterarbeitszeit (KW 49 bis KW 17): 37,5h/Woche = 7,5h/Tag
 */
export function getSokaTargetMinutes(date: Date): number {
  const week = getISOWeek(date);
  if (week >= 49 || week <= 17) {
    return 450; // 7,5h
  }
  return 480; // 8h
}

export function calculateWorkTime(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  date: Date
): WorkTimeStats {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const grossMinutes = Math.max(0, Math.round(diffMs / 60000));
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const targetMinutes = getSokaTargetMinutes(date);
  const overtimeMinutes = netMinutes - targetMinutes;

  return { netMinutes, targetMinutes, overtimeMinutes };
}
