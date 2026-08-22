import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { categories, auditLog } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isEssential: z.boolean().default(false),
  keywords: z.array(z.string()).default([]),
});

export async function GET() {
  await requireAuth();

  const allCategories = await db.query.categories.findMany({
    where: isNull(categories.archivedAt),
    orderBy: [asc(categories.sortOrder)],
  });

  return NextResponse.json(allCategories);
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const body = await request.json();
    const data = categorySchema.parse(body);

    // Get max sort order
    const maxOrder = await db.query.categories.findFirst({
      orderBy: (c, { desc }) => [desc(c.sortOrder)],
    });

    const [created] = await db
      .insert(categories)
      .values({
        ...data,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      })
      .returning();

    await db.insert(auditLog).values({
      entity: 'category',
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

    console.error('Category creation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
