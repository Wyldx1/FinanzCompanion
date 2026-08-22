import { db } from './db';
import { accounts, snapshots, snapshotBalances, transactions } from '@finanz/db/schema';
import { eq, and, gte, lt, desc, isNull, sql } from 'drizzle-orm';
import { getPreviousPeriod } from './utils';

export interface SnapshotMetrics {
  period: string;
  networthCents: number;
  networthChangeCents: number | null;
  liquidCents: number;
  debtsCents: number;
  incomeCents: number;
  spendCents: number | null;
  trackedCents: number;
  explainedRatio: number | null;
  savingsRate: number | null;
  runwayMonths: number;
}

export async function getSnapshotWithBalances(period: string) {
  const snapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, period),
    with: {
      balances: {
        with: {
          account: true,
        },
      },
    },
  });

  return snapshot;
}

export async function getActiveAccounts() {
  const result = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [accounts.sortOrder],
  });

  return result;
}

export async function calculateNetworth(period: string): Promise<{
  networth: number;
  liquid: number;
  debts: number;
}> {
  const snapshot = await getSnapshotWithBalances(period);

  if (!snapshot) {
    return { networth: 0, liquid: 0, debts: 0 };
  }

  let networth = 0;
  let liquid = 0;
  let debts = 0;

  for (const balance of snapshot.balances) {
    const account = balance.account;

    if (!account.includeInNetworth) continue;

    if (account.kind === 'liability') {
      debts += balance.balanceCents;
      networth -= balance.balanceCents;
    } else {
      networth += balance.balanceCents;

      if (['checking', 'cash', 'savings'].includes(account.kind)) {
        liquid += balance.balanceCents;
      }
    }
  }

  return { networth, liquid, debts };
}

export async function calculateSpend(period: string): Promise<number | null> {
  const prevPeriod = getPreviousPeriod(period);

  const [currentSnapshot, prevSnapshot] = await Promise.all([
    getSnapshotWithBalances(period),
    getSnapshotWithBalances(prevPeriod),
  ]);

  // Spend can only be derived when both periods have a snapshot
  if (!currentSnapshot || !prevSnapshot) return null;

  const [currentLiquid, prevLiquid] = await Promise.all([
    calculateNetworth(period),
    calculateNetworth(prevPeriod),
  ]);

  const income = currentSnapshot.incomeCents;
  const delta = currentLiquid.liquid - prevLiquid.liquid;
  const debtChange = prevLiquid.debts - currentLiquid.debts;

  // spend = income - delta - debtChange
  const spend = income - delta - debtChange;

  return Math.max(0, spend);
}

export async function getTrackedExpenses(period: string): Promise<number> {
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(amount_cents), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.direction, 'expense'),
        gte(transactions.occurredOn, startDate),
        lt(transactions.occurredOn, endDate)
      )
    );

  return Number(result[0]?.total) || 0;
}

export async function calculateMetrics(period: string): Promise<SnapshotMetrics | null> {
  const snapshot = await getSnapshotWithBalances(period);

  if (!snapshot || snapshot.status !== 'complete') {
    return null;
  }

  const prevPeriod = getPreviousPeriod(period);
  const [current, prevSnapshot] = await Promise.all([
    calculateNetworth(period),
    getSnapshotWithBalances(prevPeriod),
  ]);
  const previous = prevSnapshot ? await calculateNetworth(prevPeriod) : null;

  const spend = await calculateSpend(period);
  const tracked = await getTrackedExpenses(period);

  const explainedRatio = spend !== null
    ? spend > 0
      ? Math.min(1, tracked / spend)
      : 0
    : null;
  const savingsRate = spend !== null
    ? snapshot.incomeCents > 0
      ? (snapshot.incomeCents - spend) / snapshot.incomeCents
      : 0
    : null;

  // Calculate runway (median of last 6 months spend)
  const recentPeriods: string[] = [];
  let p = period;
  for (let i = 0; i < 6; i++) {
    p = getPreviousPeriod(p);
    recentPeriods.push(p);
  }

  const spends: number[] = [];
  for (const rp of recentPeriods) {
    const s = await calculateSpend(rp);
    if (s !== null && s > 0) spends.push(s);
  }

  let runwayMonths = 0;
  if (spends.length > 0) {
    spends.sort((a, b) => a - b);
    const medianSpend = spends[Math.floor(spends.length / 2)];
    runwayMonths = medianSpend > 0 ? current.liquid / medianSpend : 0;
  }

  return {
    period,
    networthCents: current.networth,
    networthChangeCents: previous ? current.networth - previous.networth : null,
    liquidCents: current.liquid,
    debtsCents: current.debts,
    incomeCents: snapshot.incomeCents,
    spendCents: spend,
    trackedCents: tracked,
    explainedRatio,
    savingsRate,
    runwayMonths,
  };
}

export async function getNetworthHistory(limit: number = 24): Promise<{
  period: string;
  networth: number;
  liquid: number;
  debts: number;
}[]> {
  const completedSnapshots = await db
    .select({ period: snapshots.period })
    .from(snapshots)
    .where(eq(snapshots.status, 'complete'))
    .orderBy(desc(snapshots.period))
    .limit(limit);

  const history: {
    period: string;
    networth: number;
    liquid: number;
    debts: number;
  }[] = [];

  for (const s of completedSnapshots.reverse()) {
    const data = await calculateNetworth(s.period);
    history.push({
      period: s.period,
      ...data,
    });
  }

  return history;
}
