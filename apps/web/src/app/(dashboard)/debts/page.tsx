import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { accounts, snapshots, transactions } from '@finanz/db/schema';
import { eq, and, isNull, desc, gte, lt, inArray, sql } from 'drizzle-orm';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Plus, CreditCard, TrendingDown, Wallet, Pencil, Receipt } from 'lucide-react';
import Link from 'next/link';

export default async function DebtsPage() {
  const liabilityAccounts = await db.query.accounts.findMany({
    where: and(eq(accounts.kind, 'liability'), isNull(accounts.archivedAt)),
    orderBy: [accounts.sortOrder],
  });

  // Latest completed snapshot balances for liability accounts
  const latestSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.status, 'complete'),
    orderBy: [desc(snapshots.period)],
    with: {
      balances: true,
    },
  });

  const snapshotBalanceByAccount = new Map<number, number>();
  let snapshotPeriod: string | null = null;
  if (latestSnapshot) {
    snapshotPeriod = latestSnapshot.period;
    for (const b of latestSnapshot.balances) {
      snapshotBalanceByAccount.set(b.accountId, b.balanceCents);
    }
  }

  // Calculate current balance = snapshot balance + transactions since snapshot start
  const transactionStart = snapshotPeriod
    ? new Date(parseInt(snapshotPeriod.split('-')[0]), parseInt(snapshotPeriod.split('-')[1]), 1)
    : new Date(0);

  const accountIds = liabilityAccounts.map((a) => a.id);

  const txImpact = accountIds.length > 0
    ? await db
        .select({
          accountId: transactions.accountId,
          total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        })
        .from(transactions)
        .where(and(
          inArray(transactions.accountId, accountIds),
          gte(transactions.occurredOn, transactionStart)
        ))
        .groupBy(transactions.accountId)
    : [];

  const expenseByAccount = new Map<number, number>();
  for (const row of txImpact) {
    if (row.accountId !== null) {
      expenseByAccount.set(row.accountId, Number(row.total) || 0);
    }
  }

  const enrichedAccounts = liabilityAccounts.map((account) => {
    const snapshotBalance = snapshotBalanceByAccount.get(account.id) ?? 0;
    const expensesSinceSnapshot = expenseByAccount.get(account.id) ?? 0;
    const currentBalance = snapshotBalance + expensesSinceSnapshot;
    return {
      ...account,
      currentBalance,
      snapshotBalance,
    };
  });

  const totalDebt = enrichedAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalSnapshotDebt = enrichedAccounts.reduce((sum, a) => sum + a.snapshotBalance, 0);
  const totalPaid = Math.max(0, totalSnapshotDebt - totalDebt);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Schulden</h1>
          <p className="text-muted-foreground mt-1">
            {liabilityAccounts.length} Schuld{liabilityAccounts.length !== 1 && 'en'}
          </p>
        </div>
        <Link href="/accounts/new?kind=liability">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neue Schuld
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      {liabilityAccounts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktuelle Gesamtschuld</p>
                  <p className="text-2xl font-bold text-[hsl(330,80%,75%)] mt-1">
                    {formatCurrency(totalDebt)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-[hsl(330,80%,75%)]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bereits getilgt (seit letztem Abschluss)</p>
                  <p className="text-2xl font-bold text-[hsl(172,66%,65%)] mt-1">
                    {formatCurrency(totalPaid)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-[hsl(172,66%,65%)]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Debts List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Alle Schulden
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrichedAccounts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">💳</span>
              </div>
              <p className="text-lg text-foreground mb-2">Keine Schulden erfasst</p>
              <p className="text-muted-foreground text-sm mb-6">
                Lege eine Schuld als Konto mit Typ „Schulden" an.
              </p>
              <Link href="/accounts/new?kind=liability">
                <Button className="glow">Neue Schuld</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {enrichedAccounts.map((account, index) => {
                const progress = account.currentBalance > 0 && account.snapshotBalance > 0
                  ? Math.max(0, Math.min(100, ((account.snapshotBalance - account.currentBalance) / account.snapshotBalance) * 100))
                  : 0;

                return (
                  <div
                    key={account.id}
                    className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center text-2xl flex-shrink-0">
                          <CreditCard className="h-6 w-6 text-[hsl(330,80%,75%)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-lg truncate">{account.name}</p>
                          {account.institution && (
                            <p className="text-sm text-muted-foreground">{account.institution}</p>
                          )}

                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Restschuld</span>
                              <span className="font-semibold">{formatCurrency(account.currentBalance)}</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[hsl(330,80%,75%)] to-primary rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{formatCurrency(account.snapshotBalance)} bei letztem Abschluss</span>
                              <span>{Math.round(progress)}% getilgt</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Link href={`/transactions?account=${account.id}`}>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary">
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/accounts/${account.id}/edit`}>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
