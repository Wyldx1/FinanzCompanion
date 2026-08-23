import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { weightEntries, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weightKg: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const item = await db.query.weightEntries.findFirst({
    where: eq(weightEntries.id, parseInt(id)),
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
      .from(weightEntries)
      .where(eq(weightEntries.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(weightEntries)
      .set({
        date: data.date ? new Date(data.date) : before.date,
        weightKg: data.weightKg ?? before.weightKg,
        notes: data.notes !== undefined ? (data.notes ?? null) : before.notes,
        updatedAt: new Date(),
      })
      .where(eq(weightEntries.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'weight_entry',
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
    .from(weightEntries)
    .where(eq(weightEntries.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
      { status: 404 }
    );
  }

  await db.delete(weightEntries).where(eq(weightEntries.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'weight_entry',
    entityId: id,
    action: 'delete',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
