import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { db } from '@/lib/db';
import { transactions, categories, auditLog } from '@finanz/db/schema';
import { desc, and, gte, lte, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const transactionSchema = z.object({
  occurredOn: z.string().transform((s) => new Date(s)),
  amountCents: z.number().positive(),
  direction: z.enum(['expense', 'income', 'transfer']),
  categoryId: z.number().nullable().optional(),
  accountId: z.number().nullable().optional(),
  targetAccountId: z.number().nullable().optional(),
  merchant: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;

  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const parsedLimit = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 100 : Math.min(parsedLimit, 1000);

    const conditions = [];
    if (from) conditions.push(gte(transactions.occurredOn, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      const inclusiveEnd = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
      conditions.push(lte(transactions.occurredOn, inclusiveEnd));
    }

    const allTransactions = await db.query.transactions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: { category: true, account: true, targetAccount: true },
      orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
      limit,
    });

    return NextResponse.json(allTransactions);
  } catch (error) {
    console.error('Transaction list error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const data = transactionSchema.parse(body);

    // Enforce account consistency: non-transfers need an account, transfers need both
    if (data.direction !== 'transfer' && (data.accountId === null || data.accountId === undefined)) {
      return NextResponse.json(
        { error: { code: 'ACCOUNT_REQUIRED', message: 'Für diese Transaktion muss ein Konto angegeben werden.' } },
        { status: 400 }
      );
    }
    if (
      data.direction === 'transfer' &&
      (data.accountId === null || data.accountId === undefined || data.targetAccountId === null || data.targetAccountId === undefined)
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'ACCOUNTS_REQUIRED',
            message: 'Für Umbuchungen müssen Quell- und Zielkonto angegeben werden.',
          },
        },
        { status: 400 }
      );
    }

    // Update category usage count if category is provided
    if (data.categoryId) {
      await db
        .update(categories)
        .set({ usageCount: sql`${categories.usageCount} + 1` })
        .where(eq(categories.id, data.categoryId));
    }

    const [created] = await db
      .insert(transactions)
      .values({
        ...data,
        source: 'web',
        confirmed: true,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'transaction',
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

    console.error('Transaction creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
