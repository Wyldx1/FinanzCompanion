import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workTimeEntries, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { calculateWorkTime } from '@finanz/db/soka';

const updateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakMinutes: z.number().min(0).optional(),
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const item = await db.query.workTimeEntries.findFirst({
    where: eq(workTimeEntries.id, parseInt(id)),
  });

  if (!item) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
      { status: 404 }
    );
  }

  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [before] = await db
      .select()
      .from(workTimeEntries)
      .where(eq(workTimeEntries.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
        { status: 404 }
      );
    }

    const startTime = data.startTime ? parseTimeToHMS(data.startTime) : before.startTime;
    const endTime = data.endTime ? parseTimeToHMS(data.endTime) : before.endTime;
    const breakMinutes = data.breakMinutes ?? before.breakMinutes;
    const date = data.date ? new Date(data.date) : before.date;

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Endzeit muss nach Startzeit liegen' } },
        { status: 400 }
      );
    }

    const stats = calculateWorkTime(startTime, endTime, breakMinutes, date);

    const [updated] = await db
      .update(workTimeEntries)
      .set({
        date,
        startTime,
        endTime,
        breakMinutes,
        site: data.site !== undefined ? (data.site ?? null) : before.site,
        notes: data.notes !== undefined ? (data.notes ?? null) : before.notes,
        netMinutes: stats.netMinutes,
        targetMinutes: stats.targetMinutes,
        overtimeMinutes: stats.overtimeMinutes,
        updatedAt: new Date(),
      })
      .where(eq(workTimeEntries.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'work_time_entry',
      entityId: id,
      action: 'update',
      beforeJson: before,
      afterJson: updated,
      actor: 'web',
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Daten' } },
        { status: 400 }
      );
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const [before] = await db
    .select()
    .from(workTimeEntries)
    .where(eq(workTimeEntries.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
      { status: 404 }
    );
  }

  await db.delete(workTimeEntries).where(eq(workTimeEntries.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'work_time_entry',
    entityId: id,
    action: 'delete',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
