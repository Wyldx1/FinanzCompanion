import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recurringExpenses, auditLog } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

const recurringExpenseSchema = z.object({
  name: z.string().min(1),
  amountCents: z.number().min(0),
  direction: z.enum(['expense', 'income', 'transfer']).default('expense'),
  categoryId: z.number().nullable().optional(),
  accountId: z.number().nullable().optional(),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  endPeriod: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  dayOfMonth: z.number().min(1).max(31).default(1),
  active: z.boolean().default(true),
});

export async function GET() {
  await requireAuth();

  const items = await db.query.recurringExpenses.findMany({
    with: { category: true, account: true },
    orderBy: [desc(recurringExpenses.createdAt)],
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = recurringExpenseSchema.parse(body);

    const [created] = await db
      .insert(recurringExpenses)
      .values({
        name: data.name,
        amountCents: data.amountCents,
        direction: data.direction,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        startPeriod: data.startPeriod,
        endPeriod: data.endPeriod ?? null,
        dayOfMonth: data.dayOfMonth,
        active: data.active,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'recurring_expense',
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

    console.error('Recurring expense creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
