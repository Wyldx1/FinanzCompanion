import { db } from './db';
import { accounts, categories, recurringExpenses, snapshots, snapshotBalances, transactions } from '@finanz/db/schema';
import { eq, and, gte, lte, lt, desc, isNull, sql } from 'drizzle-orm';
import { getPreviousPeriod } from './utils';

function getNextPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function periodToFirstDay(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

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

export interface CategoryExpense {
  categoryId: number | null;
  name: string;
  icon: string | null;
  totalCents: number;
}

export async function getCategoryExpenses(period: string): Promise<CategoryExpense[]> {
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({
      categoryId: transactions.categoryId,
      name: categories.name,
      icon: categories.icon,
      totalCents: sql<number>`COALESCE(SUM(amount_cents), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.direction, 'expense'),
        gte(transactions.occurredOn, startDate),
        lt(transactions.occurredOn, endDate)
      )
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon)
    .orderBy(desc(sql`COALESCE(SUM(amount_cents), 0)`));

  return result.map((row) => ({
    categoryId: row.categoryId,
    name: row.name ?? 'Sonstiges',
    icon: row.icon,
    totalCents: Number(row.totalCents) || 0,
  }));
}

export interface MonthlySpend {
  period: string;
  spendCents: number;
}

export async function getSpendingTrend(months: number = 6): Promise<MonthlySpend[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await db
    .select({
      period: sql<string>`to_char(occurred_on, 'YYYY-MM')`,
      totalCents: sql<number>`COALESCE(SUM(amount_cents), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.direction, 'expense'),
        gte(transactions.occurredOn, startDate),
        lt(transactions.occurredOn, endDate)
      )
    )
    .groupBy(sql`to_char(occurred_on, 'YYYY-MM')`);

  const byPeriod = new Map(result.map((row) => [row.period, Number(row.totalCents) || 0]));

  // Fill all calendar months, even those without transactions
  const trend: MonthlySpend[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    trend.push({ period, spendCents: byPeriod.get(period) ?? 0 });
  }

  return trend;
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

// =====================================================
// LAUFENDE PROJEKTION AUS SNAPSHOTS + TRANSAKTIONEN
// =====================================================

export interface ProjectedBalance {
  accountId: number;
  name: string;
  kind: string;
  icon: string | null;
  snapshotBalance: number | null;
  projectedBalance: number;
  difference: number;
}

export interface ProjectedSummary {
  networth: number;
  liquid: number;
  debts: number;
  lastSnapshotPeriod: string | null;
  lastSnapshotDate: Date | null;
}

export interface MonthlyTransactionSummary {
  incomeCents: number;
  expenseCents: number;
  transferOutCents: number;
  transferInCents: number;
  balanceCents: number;
}

async function getLastCompletedSnapshotBefore(asOfDate: Date) {
  const year = asOfDate.getFullYear();
  const month = String(asOfDate.getMonth() + 1).padStart(2, '0');
  const asOfPeriod = `${year}-${month}`;

  return db.query.snapshots.findFirst({
    where: and(eq(snapshots.status, 'complete'), lt(snapshots.period, asOfPeriod)),
    orderBy: [desc(snapshots.period)],
    with: {
      balances: {
        with: {
          account: true,
        },
      },
    },
  });
}

async function getTransactionImpact(
  accountId: number,
  fromDate: Date,
  toDate: Date
): Promise<{
  income: number;
  expense: number;
  transferOut: number;
  transferIn: number;
}> {
  const [outgoing, incoming] = await Promise.all([
    db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'transfer' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          gte(transactions.occurredOn, fromDate),
          lte(transactions.occurredOn, toDate)
        )
      ),
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.targetAccountId, accountId),
          gte(transactions.occurredOn, fromDate),
          lte(transactions.occurredOn, toDate)
        )
      ),
  ]);

  return {
    income: Number(outgoing[0]?.income) || 0,
    expense: Number(outgoing[0]?.expense) || 0,
    transferOut: Number(outgoing[0]?.transferOut) || 0,
    transferIn: Number(incoming[0]?.total) || 0,
  };
}

export async function getProjectedAccountBalance(
  accountId: number,
  asOfDate: Date = new Date()
): Promise<{ snapshotBalance: number | null; projectedBalance: number }> {
  const lastSnapshot = await getLastCompletedSnapshotBefore(asOfDate);

  let snapshotBalance: number | null = null;
  let transactionStart: Date;

  if (lastSnapshot) {
    const balance = lastSnapshot.balances.find((b) => b.accountId === accountId);
    snapshotBalance = balance?.balanceCents ?? null;
    transactionStart = periodToFirstDay(getNextPeriod(lastSnapshot.period));
  } else {
    transactionStart = new Date(0);
  }

  const base = snapshotBalance ?? 0;
  const impact = await getTransactionImpact(accountId, transactionStart, asOfDate);

  return {
    snapshotBalance,
    projectedBalance: base + impact.income - impact.expense - impact.transferOut + impact.transferIn,
  };
}

export async function getProjectedBalances(asOfDate: Date = new Date()): Promise<ProjectedBalance[]> {
  const lastSnapshot = await getLastCompletedSnapshotBefore(asOfDate);
  const activeAccounts = await getActiveAccounts();

  let transactionStart: Date;
  if (lastSnapshot) {
    transactionStart = periodToFirstDay(getNextPeriod(lastSnapshot.period));
  } else {
    transactionStart = new Date(0);
  }

  const snapshotBalancesByAccount = new Map<number, number>();
  if (lastSnapshot) {
    for (const b of lastSnapshot.balances) {
      snapshotBalancesByAccount.set(b.accountId, b.balanceCents);
    }
  }

  const result: ProjectedBalance[] = [];
  for (const account of activeAccounts) {
    const impact = await getTransactionImpact(account.id, transactionStart, asOfDate);
    const snapshotBalance = snapshotBalancesByAccount.get(account.id) ?? null;
    const base = snapshotBalance ?? 0;
    const projectedBalance = base + impact.income - impact.expense - impact.transferOut + impact.transferIn;

    result.push({
      accountId: account.id,
      name: account.name,
      kind: account.kind,
      icon: account.icon,
      snapshotBalance,
      projectedBalance,
      difference: projectedBalance - base,
    });
  }

  return result;
}

export async function getProjectedSummary(asOfDate: Date = new Date()): Promise<ProjectedSummary> {
  const balances = await getProjectedBalances(asOfDate);
  const lastSnapshot = await getLastCompletedSnapshotBefore(asOfDate);

  let networth = 0;
  let liquid = 0;
  let debts = 0;

  for (const b of balances) {
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, b.accountId),
    });
    if (!account || !account.includeInNetworth) continue;

    if (account.kind === 'liability') {
      debts += b.projectedBalance;
      networth -= b.projectedBalance;
    } else {
      networth += b.projectedBalance;
      if (['checking', 'cash', 'savings'].includes(account.kind)) {
        liquid += b.projectedBalance;
      }
    }
  }

  return {
    networth,
    liquid,
    debts,
    lastSnapshotPeriod: lastSnapshot?.period ?? null,
    lastSnapshotDate: lastSnapshot?.recordedAt ?? lastSnapshot?.createdAt ?? null,
  };
}

export async function getMonthlyTransactionSummary(
  period: string
): Promise<MonthlyTransactionSummary> {
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [outgoing, incoming] = await Promise.all([
    db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'transfer' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.occurredOn, startDate),
          lt(transactions.occurredOn, endDate)
        )
      ),
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.direction, 'transfer'),
          gte(transactions.occurredOn, startDate),
          lt(transactions.occurredOn, endDate)
        )
      ),
  ]);

  const income = Number(outgoing[0]?.income) || 0;
  const expense = Number(outgoing[0]?.expense) || 0;
  const transferOut = Number(outgoing[0]?.transferOut) || 0;
  const transferIn = Number(incoming[0]?.total) || 0;

  return {
    incomeCents: income,
    expenseCents: expense,
    transferOutCents: transferOut,
    transferInCents: transferIn,
    balanceCents: income - expense,
  };
}

export interface RecurringPlan {
  incomeCents: number;
  expenseCents: number;
  activeCount: number;
}

export async function getRecurringPlan(period: string): Promise<RecurringPlan> {
  const items = await db.query.recurringExpenses.findMany({
    where: eq(recurringExpenses.active, true),
  });

  const activeItems = items.filter(
    (item) =>
      period >= item.startPeriod &&
      (!item.endPeriod || period <= item.endPeriod)
  );

  const income = activeItems
    .filter((item) => item.direction === 'income')
    .reduce((sum, item) => sum + item.amountCents, 0);
  const expense = activeItems
    .filter((item) => item.direction === 'expense')
    .reduce((sum, item) => sum + item.amountCents, 0);

  return {
    incomeCents: income,
    expenseCents: expense,
    activeCount: activeItems.length,
  };
}

export async function getProjectedMonthlyBalance(period: string): Promise<{
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}> {
  const txSummary = await getMonthlyTransactionSummary(period);
  const recurring = await getRecurringPlan(period);

  return {
    incomeCents: txSummary.incomeCents + recurring.incomeCents,
    expenseCents: txSummary.expenseCents + recurring.expenseCents,
    balanceCents: txSummary.balanceCents + recurring.incomeCents - recurring.expenseCents,
  };
}

