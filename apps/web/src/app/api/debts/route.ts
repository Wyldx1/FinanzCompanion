import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { debts, accounts, auditLog } from '@finanz/db/schema';
import { eq, isNull, desc } from 'drizzle-orm';
import { z } from 'zod';

const debtSchema = z.object({
  creditor: z.string().min(1),
  originalCents: z.number().min(0).default(0),
  interestRatePercent: z.number().min(0).max(100).default(0),
  minimumPaymentCents: z.number().min(0).default(0),
  dueDay: z.number().min(1).max(31).nullable().optional(),
  targetPayoffDate: z.string().nullable().optional().transform((s) => (s ? new Date(s) : null)),
});

export async function GET() {
  await requireAuth();

  try {
    const allDebts = await db.query.debts.findMany({
      with: { account: true },
      orderBy: [desc(debts.createdAt)],
    });

    return NextResponse.json(allDebts);
  } catch (error) {
    console.error('Debt list error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = debtSchema.parse(body);

    // Create liability account
    const maxOrder = await db.query.accounts.findFirst({
      orderBy: (a, { desc }) => [desc(a.sortOrder)],
    });

    const [account] = await db
      .insert(accounts)
      .values({
        name: data.creditor,
        kind: 'liability',
        currency: 'EUR',
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
        includeInNetworth: true,
        isDefaultPayment: false,
      })
      .returning();

    const [created] = await db
      .insert(debts)
      .values({
        accountId: account.id,
        creditor: data.creditor,
        originalCents: data.originalCents,
        interestRateBps: Math.round(data.interestRatePercent * 100),
        minimumPaymentCents: data.minimumPaymentCents,
        dueDay: data.dueDay ?? null,
        targetPayoffDate: data.targetPayoffDate,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'debt',
      entityId: String(created.id),
      action: 'create',
      afterJson: { ...created, account },
      actor: 'web',
    });

    return NextResponse.json({ ...created, account }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Daten', fields: error.errors } },
        { status: 400 }
      );
    }

    console.error('Debt creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
