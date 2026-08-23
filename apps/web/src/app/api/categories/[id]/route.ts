import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { categories, auditLog } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isEssential: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  archivedAt: z.null().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const category = await db.query.categories.findFirst({
    where: eq(categories.id, parseInt(id)),
  });

  if (!category) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Kategorie nicht gefunden' } },
      { status: 404 }
    );
  }

  return NextResponse.json(category);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [before] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)));

    if (!before) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Kategorie nicht gefunden' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, parseInt(id)))
      .returning();

    await db.insert(auditLog).values({
      entity: 'category',
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
  { params }: { params: { id: string } }
) {
  await requireAuth();
  const { id } = params;

  const [before] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, parseInt(id)));

  if (!before) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Kategorie nicht gefunden' } },
      { status: 404 }
    );
  }

  // Archive the category (soft delete)
  await db
    .update(categories)
    .set({ archivedAt: new Date() })
    .where(eq(categories.id, parseInt(id)));

  await db.insert(auditLog).values({
    entity: 'category',
    entityId: id,
    action: 'archive',
    beforeJson: before,
    actor: 'web',
  });

  return NextResponse.json({ success: true });
}
