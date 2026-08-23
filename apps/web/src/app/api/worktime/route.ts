import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workTimeEntries, auditLog } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { calculateWorkTime } from '@finanz/db/soka';

const workTimeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().min(0).default(0),
  site: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function parseTimeToHMS(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export async function GET() {
  await requireAuth();

  const items = await db.query.workTimeEntries.findMany({
    orderBy: [desc(workTimeEntries.date), desc(workTimeEntries.createdAt)],
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = workTimeSchema.parse(body);

    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Endzeit muss nach Startzeit liegen' } },
        { status: 400 }
      );
    }

    const date = new Date(data.date);
    const stats = calculateWorkTime(
      parseTimeToHMS(data.startTime),
      parseTimeToHMS(data.endTime),
      data.breakMinutes,
      date
    );

    const [created] = await db
      .insert(workTimeEntries)
      .values({
        date,
        startTime: parseTimeToHMS(data.startTime),
        endTime: parseTimeToHMS(data.endTime),
        breakMinutes: data.breakMinutes,
        site: data.site ?? null,
        notes: data.notes ?? null,
        netMinutes: stats.netMinutes,
        targetMinutes: stats.targetMinutes,
        overtimeMinutes: stats.overtimeMinutes,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'work_time_entry',
      entityId: String(created.id),
      action: 'create',
      afterJson: created,
      actor: 'web',
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Daten', fields: error.errors } },
        { status: 400 }
      );
    }

    console.error('Work time creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
