import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { snapshots, transactions, categories } from '@finanz/db/schema';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { calculateNetworth, calculateSpend, getTrackedExpenses, getCategoryExpenses } from '@/lib/calculations';
import { notFound } from 'next/navigation';
import { CheckCircle, Clock, XCircle, CalendarDays, TrendingUp, Wallet, CreditCard, PieChart, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const statusConfig = {
  complete: {
    icon: CheckCircle,
    color: 'text-[hsl(172,66%,65%)]',
    bg: 'bg-[hsl(172,66%,65%)]/10',
    label: 'Abgeschlossen',
  },
  draft: {
    icon: Clock,
    color: 'text-[hsl(45,90%,70%)]',
    bg: 'bg-[hsl(45,90%,70%)]/10',
    label: 'Entwurf',
  },
  missed: {
    icon: XCircle,
    color: 'text-[hsl(330,80%,75%)]',
    bg: 'bg-[hsl(330,80%,75%)]/10',
    label: 'Verpasst',
  },
};

interface SnapshotDetailPageProps {
  params: Promise<{ period: string }>;
}

export default async function SnapshotDetailPage({ params }: SnapshotDetailPageProps) {
  const { period } = await params;

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

  if (!snapshot) {
    notFound();
  }

  const [networth, spend, tracked, categoryExpenses] = await Promise.all([
    calculateNetworth(period),
    calculateSpend(period),
    getTrackedExpenses(period),
    getCategoryExpenses(period),
  ]);

  const StatusIcon = statusConfig[snapshot.status].icon;

  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const monthTransactions = await db.query.transactions.findMany({
    where: and(
      gte(transactions.occurredOn, startDate),
      lt(transactions.occurredOn, endDate)
    ),
    with: { category: true, account: true, targetAccount: true },
    orderBy: [desc(transactions.occurredOn)],
  });

  const explainedRatio = spend !== null && spend > 0 ? Math.min(1, tracked / spend) : 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/history">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">
              {formatPeriod(period)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[snapshot.status].bg} ${statusConfig[snapshot.status].color}`}>
                <StatusIcon className="h-3 w-3 inline mr-1" />
                {statusConfig[snapshot.status].label}
              </span>
              {snapshot.note && (
                <span className="text-sm text-muted-foreground">{snapshot.note}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nettovermögen</p>
                <p className={`text-2xl font-bold mt-1 ${networth.networth >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                  {formatCurrency(networth.networth)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Liquide Mittel</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(networth.liquid)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-[hsl(172,66%,65%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Schulden</p>
                <p className="text-2xl font-bold mt-1 text-[hsl(330,80%,75%)]">
                  {formatCurrency(networth.debts)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-[hsl(330,80%,75%)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary */}
      <Card className="glass hover-lift">
        <CardHeader>
          <CardTitle>Monatsbilanz</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Einkommen</span>
              <span className="font-semibold text-lg text-[hsl(172,66%,65%)]">
                +{formatCurrency(snapshot.incomeCents)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Ausgaben (aus Snapshot)</span>
              <span className="font-semibold text-lg text-[hsl(330,80%,75%)]">
                {spend === null ? '—' : `-${formatCurrency(spend)}`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Erfasste Ausgaben</span>
              <span className="font-semibold text-lg">
                {formatCurrency(tracked)}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Erfassungsgrad</span>
              <span className="font-bold text-xl">
                {Math.round(explainedRatio * 100)}%
              </span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-[hsl(172,66%,65%)] rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, explainedRatio * 100))}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Balances */}
      <Card className="glass hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Kontostände
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {snapshot.balances.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Keine Kontostände erfasst.</p>
            ) : (
              snapshot.balances.map((b) => (
                <div key={b.accountId} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{b.account.icon || '💰'}</span>
                    <span>{b.account.name}</span>
                  </div>
                  <span className={`font-semibold ${b.account.kind === 'liability' ? 'text-[hsl(330,80%,75%)]' : ''}`}>
                    {formatCurrency(b.balanceCents)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="glass hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Transaktionen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Keine Transaktionen in diesem Monat.</p>
          ) : (
            <div className="space-y-2">
              {monthTransactions.map((tx) => {
                const icon = tx.category?.icon || '❓';
                const dirIcon = tx.direction === 'income' ? '➕' : tx.direction === 'expense' ? '➖' : '↔️';
                return (
                  <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{icon}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {dirIcon} {tx.merchant || tx.category?.name || 'Sonstiges'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.account?.name}
                          {tx.direction === 'transfer' && tx.targetAccount && ` → ${tx.targetAccount.name}`}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold whitespace-nowrap ${
                      tx.direction === 'income' ? 'text-[hsl(172,66%,65%)]' :
                      tx.direction === 'expense' ? 'text-[hsl(330,80%,75%)]' : 'text-[hsl(210,80%,70%)]'
                    }`}>
                      {tx.direction === 'expense' ? '-' : tx.direction === 'income' ? '+' : ''}
                      {formatCurrency(tx.amountCents)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {categoryExpenses.length > 0 && (
        <Card className="glass hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Ausgaben nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryExpenses.map((cat) => (
                <div key={cat.categoryId ?? 'unknown'} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.icon || '📦'}</span>
                    <span>{cat.name}</span>
                  </div>
                  <span className="font-semibold text-[hsl(330,80%,75%)]">
                    -{formatCurrency(cat.totalCents)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
