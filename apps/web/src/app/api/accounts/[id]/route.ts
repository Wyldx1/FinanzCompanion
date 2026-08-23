import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  accounts,
  auditLog,
  snapshotBalances,
  debts,
  transactions,
  quickActions,
  goals,
} from '@finanz/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(['checking', 'cash', 'savings', 'investment', 'receivable', 'liability']).optional(),
  institution: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  includeInNetworth: z.boolean().optional(),
  isDefaultPayment: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;
  const { id } = params;

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, parseInt(id)),
  });

  if (!account) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Konto nicht gefunden' } },
      { status: 404 }
    );
  }

  return NextResponse.json(account);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;
  const { id } = params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Coerce archivedAt to Date/null (undefined = leave unchanged)
    const updateData = {
      ...data,
      archivedAt:
        data.archivedAt === undefined
          ? undefined
          : data.archivedAt === null
            ? null
            : new Date(data.archivedAt),
    };

    const [before] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Konto nicht gefunden' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(accounts)
      .set(updateData)
      .where(eq(accounts.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'account',
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

    console.error('Account update error:', error);
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
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;
  const { id } = params;

  const hard = request.nextUrl.searchParams.get('hard') === 'true';

  const [before] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Konto nicht gefunden' } },
      { status: 404 }
    );
  }

  if (hard) {
    const accountId = parseInt(id);

    // Block hard-delete if transactions still reference this account to avoid
    // dangling/orphaned transactions that would disappear from calculations.
    const relatedTransactions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    if (relatedTransactions[0]?.count > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'HAS_TRANSACTIONS',
            message:
              'Konto kann nicht gelöscht werden, da noch Transaktionen vorhanden sind. Archiviere das Konto oder lösche zuerst die Transaktionen.',
          },
        },
        { status: 400 }
      );
    }

    // Remove dependent data / clear references before deleting the account
    try {
      await db.transaction(async (tx) => {
        await tx.delete(snapshotBalances).where(eq(snapshotBalances.accountId, accountId));
        await tx.delete(debts).where(eq(debts.accountId, accountId));
        await tx
          .update(quickActions)
          .set({ accountId: null })
          .where(eq(quickActions.accountId, accountId));
        await tx
          .update(goals)
          .set({ linkedAccountId: null })
          .where(eq(goals.linkedAccountId, accountId));
        await tx.delete(accounts).where(eq(accounts.id, accountId));
      });
    } catch (error) {
      console.error('Account deletion error:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
        { status: 500 }
      );
    }
  } else {
    // Archive the account
    await db
      .update(accounts)
      .set({ archivedAt: new Date() })
      .where(eq(accounts.id, parseInt(id)));
  }

  await db.insert(auditLog).values({
    entity: 'account',
    entityId: id,
    action: hard ? 'delete' : 'archive',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
