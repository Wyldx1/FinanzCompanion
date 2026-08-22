import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts, auditLog } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';
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
