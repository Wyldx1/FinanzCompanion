import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { db } from '@/lib/db';
import { goals, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(['emergency_fund', 'purchase', 'debt_payoff', 'retirement', 'custom']).optional(),
  targetCents: z.number().positive().optional(),
  targetDate: z.string().transform((s) => new Date(s)).nullable().optional(),
  priority: z.number().min(1).max(10).optional(),
  linkedAccountId: z.number().nullable().optional(),
  monthlyPlanCents: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  achievedAt: z.string().datetime().transform((s) => new Date(s)).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, parseInt(id)),
    with: { linkedAccount: true, contributions: true },
  });

  if (!goal) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Ziel nicht gefunden' } },
      { status: 404 }
    );
  }

  return NextResponse.json(goal);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [before] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Ziel nicht gefunden' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(goals)
      .set(data)
      .where(eq(goals.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'goal',
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
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const [before] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Ziel nicht gefunden' } },
      { status: 404 }
    );
  }

  // Soft delete by setting isActive to false
  await db
    .update(goals)
    .set({ isActive: false })
    .where(eq(goals.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'goal',
    entityId: id,
    action: 'archive',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
