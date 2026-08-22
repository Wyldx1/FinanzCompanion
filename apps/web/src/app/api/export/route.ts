import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  await requireAuth();

  const format = request.nextUrl.searchParams.get('format') || 'json';

  if (format !== 'json') {
    return NextResponse.json(
      { error: { code: 'NOT_IMPLEMENTED', message: 'Only JSON export is currently supported' } },
      { status: 400 }
    );
  }

  // Export all data
  const [accounts, snapshots, transactions, categories, goals, debts, adviceLogs] =
    await Promise.all([
      db.query.accounts.findMany(),
      db.query.snapshots.findMany({
        with: { balances: true },
      }),
      db.query.transactions.findMany(),
      db.query.categories.findMany(),
      db.query.goals.findMany({
        with: { contributions: true },
      }),
      db.query.debts.findMany(),
      db.query.adviceLog.findMany(),
    ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    accounts,
    snapshots,
    transactions,
    categories,
    goals,
    debts,
    adviceLogs,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="finanz-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
