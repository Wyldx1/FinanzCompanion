import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workTimeEntries } from '@finanz/db/schema';
import { and, gte, lt } from 'drizzle-orm';

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.abs(minutes % 60);
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

export async function GET(request: NextRequest) {
  await requireAuth();

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const period = searchParams.get('period');

  let startDate: Date;
  let endDate: Date;
  let filename: string;

  if (period) {
    const [y, m] = period.split('-').map(Number);
    startDate = new Date(y, m - 1, 1);
    endDate = new Date(y, m, 1);
    filename = `arbeitszeit-${period}.csv`;
  } else if (year) {
    const y = parseInt(year);
    startDate = new Date(y, 0, 1);
    endDate = new Date(y + 1, 0, 1);
    filename = `arbeitszeit-${year}.csv`;
  } else {
    return NextResponse.json(
      { error: { code: 'MISSING_PARAM', message: 'year oder period angeben' } },
      { status: 400 }
    );
  }

  const items = await db.query.workTimeEntries.findMany({
    where: and(
      gte(workTimeEntries.date, startDate),
      lt(workTimeEntries.date, endDate)
    ),
    orderBy: [workTimeEntries.date],
  });

  const header = ['Datum', 'Start', 'Ende', 'Pause (min)', 'Netto', 'Soll', 'Überstunden', 'Baustelle', 'Notizen'];
  const rows = items.map((item) => [
    item.date.toISOString().split('T')[0],
    formatTime(item.startTime),
    formatTime(item.endTime),
    String(item.breakMinutes),
    formatMinutes(item.netMinutes),
    formatMinutes(item.targetMinutes),
    formatMinutes(item.overtimeMinutes),
    item.site || '',
    item.notes || '',
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(';')
    )
    .join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
