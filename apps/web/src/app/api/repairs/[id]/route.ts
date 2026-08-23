import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { repairs, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const repairSchema = z.object({
  vehicleId: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  odometerKm: z.number().int().min(0).optional().nullable(),
  description: z.string().min(1).optional(),
  costCents: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Ungültige ID' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = repairSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.vehicleId !== undefined) updateData.vehicleId = data.vehicleId;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.odometerKm !== undefined) updateData.odometerKm = data.odometerKm;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.costCents !== undefined) updateData.costCents = data.costCents;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await db
      .update(repairs)
      .set(updateData)
      .where(eq(repairs.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Reparatur nicht gefunden' } },
        { status: 404 }
      );
    }

    await db.insert(auditLog).values({
      entity: 'repair',
      entityId: String(updated.id),
      action: 'update',
      afterJson: updated,
      actor: 'web',
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Daten', fields: error.errors } },
        { status: 400 }
      );
    }

    console.error('Repair update error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Ungültige ID' } },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(repairs)
      .where(eq(repairs.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Reparatur nicht gefunden' } },
        { status: 404 }
      );
    }

    await db.insert(auditLog).values({
      entity: 'repair',
      entityId: String(deleted.id),
      action: 'delete',
      beforeJson: deleted,
      actor: 'web',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Repair delete error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
