import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fuelEntries, auditLog } from '@finanz/db/schema';
import { desc, eq, and, lt } from 'drizzle-orm';
import { z } from 'zod';

const fuelEntrySchema = z.object({
  vehicleId: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometerKm: z.number().int().min(0),
  quantity: z.number().min(0),
  pricePerUnitCents: z.number().min(0),
  totalCents: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  await requireAuth();

  const items = await db.query.fuelEntries.findMany({
    with: { vehicle: true },
    orderBy: [desc(fuelEntries.date), desc(fuelEntries.createdAt)],
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = fuelEntrySchema.parse(body);

    const date = new Date(data.date);
    const totalCents = data.totalCents ?? Math.round(data.quantity * data.pricePerUnitCents);

    const [created] = await db
      .insert(fuelEntries)
      .values({
        vehicleId: data.vehicleId,
        date,
        odometerKm: data.odometerKm,
        quantity: data.quantity,
        pricePerUnitCents: data.pricePerUnitCents,
        totalCents,
        notes: data.notes ?? null,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'fuel_entry',
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

    console.error('Fuel entry creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
