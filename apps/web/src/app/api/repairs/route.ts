import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { repairs, auditLog } from '@finanz/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const repairSchema = z.object({
  vehicleId: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometerKm: z.number().int().min(0).optional(),
  description: z.string().min(1),
  costCents: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  await requireAuth();

  const vehicleId = request.nextUrl.searchParams.get('vehicle');

  const items = await db.query.repairs.findMany({
    where: vehicleId ? eq(repairs.vehicleId, parseInt(vehicleId)) : undefined,
    with: { vehicle: true },
    orderBy: [desc(repairs.date), desc(repairs.createdAt)],
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = repairSchema.parse(body);

    const [created] = await db
      .insert(repairs)
      .values({
        vehicleId: data.vehicleId,
        date: new Date(data.date),
        odometerKm: data.odometerKm ?? null,
        description: data.description,
        costCents: data.costCents,
        notes: data.notes ?? null,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'repair',
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

    console.error('Repair creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
