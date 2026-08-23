import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recurringExpenses, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  amountCents: z.number().min(0).optional(),
  direction: z.enum(['expense', 'income', 'transfer']).optional(),
  categoryId: z.number().nullable().optional(),
  accountId: z.number().nullable().optional(),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  endPeriod: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const item = await db.query.recurringExpenses.findFirst({
    where: eq(recurringExpenses.id, parseInt(id)),
    with: { category: true, account: true },
  });

  if (!item) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Dauerauftrag nicht gefunden' } },
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
      .from(recurringExpenses)
      .where(eq(recurringExpenses.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Dauerauftrag nicht gefunden' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(recurringExpenses)
      .set(data)
      .where(eq(recurringExpenses.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'recurring_expense',
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
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Dauerauftrag nicht gefunden' } },
      { status: 404 }
    );
  }

  await db.delete(recurringExpenses).where(eq(recurringExpenses.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'recurring_expense',
    entityId: id,
    action: 'delete',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
