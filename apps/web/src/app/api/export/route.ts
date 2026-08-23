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

  // Export all user data (exclude auth/session/audit infrastructure)
  const [
    accounts,
    snapshots,
    transactions,
    categories,
    quickActions,
    recurringExpenses,
    goals,
    debts,
    vehicles,
    fuelEntries,
    repairs,
    workTimeEntries,
    weightEntries,
    moduleSettings,
    adviceLogs,
    commitmentResults,
  ] = await Promise.all([
    db.query.accounts.findMany(),
    db.query.snapshots.findMany({
      with: { balances: true },
    }),
    db.query.transactions.findMany(),
    db.query.categories.findMany(),
    db.query.quickActions.findMany(),
    db.query.recurringExpenses.findMany(),
    db.query.goals.findMany({
      with: { contributions: true },
    }),
    db.query.debts.findMany(),
    db.query.vehicles.findMany(),
    db.query.fuelEntries.findMany(),
    db.query.repairs.findMany(),
    db.query.workTimeEntries.findMany(),
    db.query.weightEntries.findMany(),
    db.query.moduleSettings.findMany(),
    db.query.adviceLog.findMany(),
    db.query.commitmentResults.findMany(),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    accounts,
    snapshots,
    transactions,
    categories,
    quickActions,
    recurringExpenses,
    goals,
    debts,
    vehicles,
    fuelEntries,
    repairs,
    workTimeEntries,
    weightEntries,
    moduleSettings,
    adviceLogs,
    commitmentResults,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="finanz-backup-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
