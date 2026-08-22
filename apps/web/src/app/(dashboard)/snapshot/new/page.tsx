import { SnapshotForm } from '@/components/snapshot-form';
import { db } from '@/lib/db';
import { accounts, snapshots, snapshotBalances } from '@finanz/db/schema';
import { eq, isNull, desc } from 'drizzle-orm';
import { getCurrentPeriod, getPreviousPeriod } from '@/lib/utils';

export default async function NewSnapshotPage() {
  const currentPeriod = getCurrentPeriod();
  const prevPeriod = getPreviousPeriod(currentPeriod);

  // Get active accounts
  const activeAccounts = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [accounts.sortOrder],
  });

  // Get previous snapshot values for pre-filling
  const prevSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, prevPeriod),
    with: {
      balances: true,
    },
  });

  // Get current draft if exists
  const currentSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, currentPeriod),
    with: {
      balances: true,
    },
  });

  // Build initial values
  const initialValues: Record<number, number> = {};

  // First, fill with previous values
  if (prevSnapshot) {
    for (const balance of prevSnapshot.balances) {
      initialValues[balance.accountId] = balance.balanceCents;
    }
  }

  // Override with current draft values
  if (currentSnapshot) {
    for (const balance of currentSnapshot.balances) {
      initialValues[balance.accountId] = balance.balanceCents;
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <SnapshotForm
        period={currentPeriod}
        accounts={activeAccounts}
        initialValues={initialValues}
        initialIncome={currentSnapshot?.incomeCents || 0}
        initialNote={currentSnapshot?.note || ''}
        isEdit={!!currentSnapshot}
      />
    </div>
  );
}
