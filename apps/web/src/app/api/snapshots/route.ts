import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { snapshots, snapshotBalances, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const snapshotSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  balances: z.array(
    z.object({
      accountId: z.number(),
      balanceCents: z.number(),
    })
  ),
  incomeCents: z.number(),
  note: z.string().nullable(),
  complete: z.boolean(),
});

export async function GET() {
  await requireAuth();

  const allSnapshots = await db.query.snapshots.findMany({
    orderBy: (s, { desc }) => [desc(s.period)],
  });

  return NextResponse.json(allSnapshots);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const { period, balances, incomeCents, note, complete } = snapshotSchema.parse(body);

    // Check if snapshot exists
    const existing = await db.query.snapshots.findFirst({
      where: eq(snapshots.period, period),
    });

    let snapshotId: number;

    if (existing) {
      // Update existing snapshot
      const [updated] = await db
        .update(snapshots)
        .set({
          incomeCents,
          note,
          status: complete ? 'complete' : 'draft',
          recordedAt: complete ? new Date() : null,
        })
        .where(eq(snapshots.id, existing.id))
        .returning();

      snapshotId = updated.id;

      // Delete old balances
      await db.delete(snapshotBalances).where(eq(snapshotBalances.snapshotId, snapshotId));
    } else {
      // Create new snapshot
      const [created] = await db
        .insert(snapshots)
        .values({
          period,
          incomeCents,
          note,
          status: complete ? 'complete' : 'draft',
          recordedAt: complete ? new Date() : null,
        })
        .returning();

      snapshotId = created.id;
    }

    // Insert balances
    if (balances.length > 0) {
      await db.insert(snapshotBalances).values(
        balances.map((b) => ({
          snapshotId,
          accountId: b.accountId,
          balanceCents: b.balanceCents,
        }))
      );
    }

    // Audit log
    await db.insert(auditLog).values({
      entity: 'snapshot',
      entityId: period,
      action: existing ? 'update' : 'create',
      afterJson: { period, balances, incomeCents, note, complete },
      actor: 'web',
    });

    return NextResponse.json({ success: true, snapshotId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Daten', fields: error.errors } },
        { status: 400 }
      );
    }

    console.error('Snapshot error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
