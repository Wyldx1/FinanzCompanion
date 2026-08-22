import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { goals, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const goalSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['emergency_fund', 'purchase', 'debt_payoff', 'retirement', 'custom']),
  targetCents: z.number().positive(),
  targetDate: z.string().transform((s) => new Date(s)).nullable().optional(),
  priority: z.number().min(1).max(10).default(5),
  linkedAccountId: z.number().nullable().optional(),
  monthlyPlanCents: z.number().positive().nullable().optional(),
});

export async function GET() {
  await requireAuth();

  const allGoals = await db.query.goals.findMany({
    where: eq(goals.isActive, true),
    with: { linkedAccount: true, contributions: true },
  });

  return NextResponse.json(allGoals);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = goalSchema.parse(body);

    const [created] = await db
      .insert(goals)
      .values(data)
      .returning();

    await db.insert(auditLog).values({
      entity: 'goal',
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

    console.error('Goal creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
