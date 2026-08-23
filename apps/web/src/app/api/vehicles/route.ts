import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vehicles } from '@finanz/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  await requireAuth();

  const allVehicles = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  return NextResponse.json(allVehicles);
}
