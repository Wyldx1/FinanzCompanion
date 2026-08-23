import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { weightEntries, auditLog } from '@finanz/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const weightEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().min(0),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  await requireAuth();

  const items = await db.query.weightEntries.findMany({
    orderBy: [desc(weightEntries.date), desc(weightEntries.createdAt)],
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = weightEntrySchema.parse(body);

    const [created] = await db
      .insert(weightEntries)
      .values({
        date: new Date(data.date),
        weightKg: data.weightKg,
        notes: data.notes ?? null,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'weight_entry',
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

    console.error('Weight entry creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
