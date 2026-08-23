import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { accounts, snapshots, transactions, debts } from '@finanz/db/schema';
import { eq, and, isNull, desc, gte, lt, inArray, sql } from 'drizzle-orm';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Plus, CreditCard, TrendingDown, Pencil, Receipt, ArrowDownLeft } from 'lucide-react';
import Link from 'next/link';

export default async function DebtsPage() {
  const liabilityAccounts = await db.query.accounts.findMany({
    where: and(eq(accounts.kind, 'liability'), isNull(accounts.archivedAt)),
    orderBy: [accounts.sortOrder],
    with: {
      debt: true,
    },
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
          income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
          expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        })
        .from(transactions)
        .where(and(
          inArray(transactions.accountId, accountIds),
          gte(transactions.occurredOn, transactionStart)
        ))
        .groupBy(transactions.accountId)
    : [];

  const impactByAccount = new Map<number, { income: number; expense: number }>();
  for (const row of txImpact) {
    if (row.accountId !== null) {
      impactByAccount.set(row.accountId, {
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
      });
    }
  }

  const enrichedAccounts = liabilityAccounts.map((account) => {
    const snapshotBalance = snapshotBalanceByAccount.get(account.id) ?? 0;
    const impact = impactByAccount.get(account.id) ?? { income: 0, expense: 0 };
    // Einnahme auf liability = neue Schuld (+)
    // Ausgabe auf liability = Tilgung (-)
    const currentBalance = snapshotBalance + impact.income - impact.expense;
    const debt = account.debt;
    const originalCents = debt?.originalCents ?? null;

    // Realer Tilgungsfortschritt anhand der ursprünglichen Schuld
    let realProgress = 0;
    if (originalCents && originalCents > 0 && currentBalance > 0) {
      realProgress = Math.max(0, Math.min(1, (originalCents - currentBalance) / originalCents));
    }

    return {
      ...account,
      currentBalance,
      snapshotBalance,
      debt,
      realProgress,
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
                const progressBasis = account.debt?.originalCents ?? account.snapshotBalance;
                const progress = progressBasis > 0 && account.currentBalance > 0
                  ? Math.max(0, Math.min(100, ((progressBasis - account.currentBalance) / progressBasis) * 100))
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
                              <span>
                                {account.debt?.originalCents
                                  ? `${formatCurrency(account.debt.originalCents)} ursprünglich`
                                  : `${formatCurrency(account.snapshotBalance)} bei letztem Abschluss`}
                              </span>
                              <span>{Math.round(progress)}% getilgt</span>
                            </div>
                          </div>

                          {/* Debt details */}
                          {account.debt ? (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div className="p-2 rounded-lg bg-secondary/70">
                                <span className="text-muted-foreground block">Original</span>
                                <span className="font-medium">{formatCurrency(account.debt.originalCents)}</span>
                              </div>
                              {account.debt.interestRateBps > 0 && (
                                <div className="p-2 rounded-lg bg-secondary/70">
                                  <span className="text-muted-foreground block">Zinssatz</span>
                                  <span className="font-medium">{(account.debt.interestRateBps / 100).toFixed(2)}%</span>
                                </div>
                              )}
                              {account.debt.minimumPaymentCents > 0 && (
                                <div className="p-2 rounded-lg bg-secondary/70">
                                  <span className="text-muted-foreground block">Mindesttilgung</span>
                                  <span className="font-medium">{formatCurrency(account.debt.minimumPaymentCents)}</span>
                                </div>
                              )}
                              {account.debt.dueDay && (
                                <div className="p-2 rounded-lg bg-secondary/70">
                                  <span className="text-muted-foreground block">Fälligkeit</span>
                                  <span className="font-medium">{account.debt.dueDay}. im Monat</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Keine Schulden-Details hinterlegt. Nur Kontostand wird angezeigt.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <Link href={`/transactions/new?accountId=${account.id}&direction=expense&note=Schuldentilgung`}>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary" title="Tilgung buchen">
                            <ArrowDownLeft className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/transactions?account=${account.id}`}>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary" title="Buchungen anzeigen">
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/accounts/${account.id}/edit`}>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary" title="Bearbeiten">
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
