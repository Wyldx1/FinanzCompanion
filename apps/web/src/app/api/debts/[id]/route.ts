import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { debts, accounts, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  creditor: z.string().min(1).optional(),
  originalCents: z.number().min(0).optional(),
  interestRatePercent: z.number().min(0).max(100).optional(),
  minimumPaymentCents: z.number().min(0).optional(),
  dueDay: z.number().min(1).max(31).nullable().optional(),
  targetPayoffDate: z.string().nullable().optional().transform((s) => (s ? new Date(s) : null)),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;

  const debt = await db.query.debts.findFirst({
    where: eq(debts.id, parseInt(id)),
    with: { account: true },
  });

  if (!debt) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Schuld nicht gefunden' } },
      { status: 404 }
    );
  }

  return NextResponse.json(debt);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [before] = await db.select().from(debts).where(eq(debts.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Schuld nicht gefunden' } },
        { status: 404 }
      );
    }

    const updateValues: Partial<typeof debts.$inferInsert> = {};
    if (data.creditor !== undefined) updateValues.creditor = data.creditor;
    if (data.originalCents !== undefined) updateValues.originalCents = data.originalCents;
    if (data.interestRatePercent !== undefined) {
      updateValues.interestRateBps = Math.round(data.interestRatePercent * 100);
    }
    if (data.minimumPaymentCents !== undefined) updateValues.minimumPaymentCents = data.minimumPaymentCents;
    if (data.dueDay !== undefined) updateValues.dueDay = data.dueDay ?? null;
    if (data.targetPayoffDate !== undefined) updateValues.targetPayoffDate = data.targetPayoffDate;

    const [updated] = await db
      .update(debts)
      .set(updateValues)
      .where(eq(debts.id, parseInt(id)))
      .returning();

    // Update account name if creditor changed
    if (data.creditor) {
      await db
        .update(accounts)
        .set({ name: data.creditor })
        .where(eq(accounts.id, updated.accountId));
    }

    await db.insert(auditLog).values({
      entity: 'debt',
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
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;

  const [before] = await db.select().from(debts).where(eq(debts.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Schuld nicht gefunden' } },
      { status: 404 }
    );
  }

  // Delete debt and archive associated account
  await db.delete(debts).where(eq(debts.id, parseInt(id)));
  await db
    .update(accounts)
    .set({ archivedAt: new Date() })
    .where(eq(accounts.id, before.accountId));

  await db.insert(auditLog).values({
    entity: 'debt',
    entityId: id,
    action: 'delete',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
