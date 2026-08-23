import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts, auditLog, snapshots, snapshotBalances } from '@finanz/db/schema';
import { isNull, asc, eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const accountSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['checking', 'cash', 'savings', 'investment', 'receivable', 'liability']),
  currency: z.string().length(3).default('EUR'),
  institution: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  includeInNetworth: z.boolean().default(true),
  isDefaultPayment: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  initialBalanceCents: z.number().int().min(0).optional(),
});

export async function GET() {
  await requireAuth();

  const allAccounts = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [asc(accounts.sortOrder)],
  });

  return NextResponse.json(allAccounts);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = accountSchema.parse(body);

    // Get max sort order
    const maxOrder = await db.query.accounts.findFirst({
      orderBy: (a, { desc }) => [desc(a.sortOrder)],
    });

    const [created] = await db
      .insert(accounts)
      .values({
        ...data,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      })
      .returning();

    // For liability accounts with an initial balance, create/update current month snapshot
    if (data.kind === 'liability' && data.initialBalanceCents !== undefined) {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const existingSnapshot = await db.query.snapshots.findFirst({
        where: eq(snapshots.period, period),
      });

      let snapshotId: number;
      let existingBalances: { accountId: number; balanceCents: number }[] = [];

      if (existingSnapshot) {
        snapshotId = existingSnapshot.id;
        const balances = await db.query.snapshotBalances.findMany({
          where: eq(snapshotBalances.snapshotId, snapshotId),
        });
        existingBalances = balances.map((b) => ({
          accountId: b.accountId,
          balanceCents: b.balanceCents,
        }));
        await db.delete(snapshotBalances).where(eq(snapshotBalances.snapshotId, snapshotId));
      } else {
        // Try to carry over balances from the latest completed snapshot
        const latestSnapshot = await db.query.snapshots.findFirst({
          where: eq(snapshots.status, 'complete'),
          orderBy: [desc(snapshots.period)],
          with: { balances: true },
        });

        if (latestSnapshot) {
          existingBalances = latestSnapshot.balances.map((b) => ({
            accountId: b.accountId,
            balanceCents: b.balanceCents,
          }));
        }

        const [createdSnapshot] = await db
          .insert(snapshots)
          .values({
            period,
            incomeCents: 0,
            note: `Automatisch aus Schulden-Erstellung für ${created.name}`,
            status: 'complete',
            recordedAt: new Date(),
          })
          .returning();
        snapshotId = createdSnapshot.id;
      }

      // Merge balances, ensure new account is included
      const balanceMap = new Map<number, number>();
      for (const b of existingBalances) {
        balanceMap.set(b.accountId, b.balanceCents);
      }
      balanceMap.set(created.id, data.initialBalanceCents);

      await db.insert(snapshotBalances).values(
        Array.from(balanceMap.entries()).map(([accountId, balanceCents]) => ({
          snapshotId,
          accountId,
          balanceCents,
        }))
      );
    }

    await db.insert(auditLog).values({
      entity: 'account',
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

    console.error('Account creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
