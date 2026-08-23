import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { transactions, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  occurredOn: z.string().transform((s) => new Date(s)).optional(),
  amountCents: z.number().positive().optional(),
  direction: z.enum(['expense', 'income', 'transfer']).optional(),
  categoryId: z.number().nullable().optional(),
  accountId: z.number().nullable().optional(),
  targetAccountId: z.number().nullable().optional(),
  merchant: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  confirmed: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;

  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, parseInt(id)),
    with: { category: true, account: true, targetAccount: true },
  });

  if (!tx) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Transaktion nicht gefunden' } },
      { status: 404 }
    );
  }

  return NextResponse.json(tx);
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

    const [before] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Transaktion nicht gefunden' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'transaction',
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

  const [before] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Transaktion nicht gefunden' } },
      { status: 404 }
    );
  }

  await db.delete(transactions).where(eq(transactions.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'transaction',
    entityId: id,
    action: 'delete',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
