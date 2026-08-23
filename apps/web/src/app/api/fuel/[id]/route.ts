import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fuelEntries, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  vehicleId: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  odometerKm: z.number().int().min(0).optional(),
  quantity: z.number().min(0).optional(),
  pricePerUnitCents: z.number().min(0).optional(),
  totalCents: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const item = await db.query.fuelEntries.findFirst({
    where: eq(fuelEntries.id, parseInt(id)),
    with: { vehicle: true },
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
      .from(fuelEntries)
      .where(eq(fuelEntries.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
        { status: 404 }
      );
    }

    const quantity = data.quantity ?? before.quantity;
    const pricePerUnitCents = data.pricePerUnitCents ?? before.pricePerUnitCents;
    const totalCents = data.totalCents ?? Math.round(quantity * pricePerUnitCents);

    const [updated] = await db
      .update(fuelEntries)
      .set({
        vehicleId: data.vehicleId ?? before.vehicleId,
        date: data.date ? new Date(data.date) : before.date,
        odometerKm: data.odometerKm ?? before.odometerKm,
        quantity,
        pricePerUnitCents,
        totalCents,
        notes: data.notes !== undefined ? (data.notes ?? null) : before.notes,
        updatedAt: new Date(),
      })
      .where(eq(fuelEntries.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'fuel_entry',
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
    .from(fuelEntries)
    .where(eq(fuelEntries.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Eintrag nicht gefunden' } },
      { status: 404 }
    );
  }

  await db.delete(fuelEntries).where(eq(fuelEntries.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'fuel_entry',
    entityId: id,
    action: 'delete',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
