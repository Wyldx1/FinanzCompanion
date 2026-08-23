import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calculateMetrics, getNetworthHistory, getCategoryExpenses, getSpendingTrend, getProjectedSummary, getMonthlyTransactionSummary } from '@/lib/calculations';
import { getCurrentPeriod, formatCurrency, formatPercent, formatPeriod } from '@/lib/utils';
import { NetworthChart } from '@/components/networth-chart';
import { CategoryChart } from '@/components/category-chart';
import { SpendingTrendChart } from '@/components/spending-trend-chart';
import { MetricCard } from '@/components/metric-card';
import { DashboardToolsOverview } from '@/components/dashboard-tools-overview';
import { TrendingUp, Plus, Sparkles, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { fuelEntries, repairs, workTimeEntries, weightEntries, recurringExpenses } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';

export default async function DashboardPage() {
  const currentPeriod = getCurrentPeriod();
  const [metrics, history, categoryExpenses, spendingTrend, projectedSummary, monthlyTxSummary, allFuelEntries, allRepairs, allWorkTimeEntries, allWeightEntries, allRecurringExpenses] = await Promise.all([
    calculateMetrics(currentPeriod),
    getNetworthHistory(24),
    getCategoryExpenses(currentPeriod),
    getSpendingTrend(6),
    getProjectedSummary(),
    getMonthlyTransactionSummary(currentPeriod),
    db.query.fuelEntries.findMany({
      with: { vehicle: true },
      orderBy: [desc(fuelEntries.date)],
    }),
    db.query.repairs.findMany({
      with: { vehicle: true },
      orderBy: [desc(repairs.date)],
    }),
    db.query.workTimeEntries.findMany({
      orderBy: [desc(workTimeEntries.date)],
    }),
    db.query.weightEntries.findMany({
      orderBy: [desc(weightEntries.date)],
    }),
    db.query.recurringExpenses.findMany({
      orderBy: [desc(recurringExpenses.createdAt)],
    }),
  ]);

  const hasData = metrics !== null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{formatPeriod(currentPeriod)}</p>
        </div>
        <Link href="/snapshot/new" className="self-start sm:self-auto">
          <Button className="glow hover-lift whitespace-nowrap">
            <Plus className="mr-2 h-4 w-4" />
            Monatsabschluss
          </Button>
        </Link>
      </div>

      {!hasData ? (
        <Card className="glass gradient-border overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 glow">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <p className="text-xl text-foreground mb-2">
              Willkommen beim Finanz-Companion
            </p>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Erstelle deinen ersten Monatsabschluss, um deine Vermögensentwicklung zu tracken.
            </p>
            <Link href="/snapshot/new">
              <Button size="lg" className="glow hover-lift">
                <Plus className="mr-2 h-5 w-5" />
                Ersten Monatsabschluss erstellen
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
            <MetricCard
              title="Nettovermögen"
              value={formatCurrency(metrics.networthCents)}
              icon={metrics.networthChangeCents === null || metrics.networthChangeCents >= 0 ? 'TrendingUp' : 'TrendingDown'}
              trend={metrics.networthChangeCents === null ? 'neutral' : metrics.networthChangeCents >= 0 ? 'up' : 'down'}
              subtitle={metrics.networthChangeCents === null
                ? 'noch keine Daten'
                : `${metrics.networthChangeCents >= 0 ? '+' : ''}${formatCurrency(metrics.networthChangeCents)}`}
            />

            <MetricCard
              title="Liquide Mittel"
              value={formatCurrency(metrics.liquidCents)}
              icon="Wallet"
              color="mint"
              subtitle="Giro, Bargeld, Tagesgeld"
            />

            <MetricCard
              title="Schulden"
              value={formatCurrency(metrics.debtsCents)}
              icon="CreditCard"
              color="pink"
              subtitle="Offene Verbindlichkeiten"
            />

            <MetricCard
              title="Runway"
              value={`${metrics.runwayMonths.toFixed(1)} Monate`}
              icon="Clock"
              color="blue"
              subtitle="Liquide / Median-Ausgaben"
            />
          </div>

          {/* Tools Overview */}
          <DashboardToolsOverview
            fuelEntries={allFuelEntries}
            repairs={allRepairs}
            workTimeEntries={allWorkTimeEntries}
            weightEntries={allWeightEntries}
            recurringExpenses={allRecurringExpenses}
            debtsCents={metrics.debtsCents}
          />

          {/* Projected Current State */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass hover-lift">
              <CardHeader>
                <CardTitle>Geschätzter aktueller Stand</CardTitle>
              </CardHeader>
              <CardContent>
                {projectedSummary.lastSnapshotPeriod ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Nettovermögen</span>
                      <span className={`font-semibold text-lg ${projectedSummary.networth >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                        {formatCurrency(projectedSummary.networth)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Liquide Mittel</span>
                      <span className="font-semibold text-lg">
                        {formatCurrency(projectedSummary.liquid)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Schulden</span>
                      <span className="font-semibold text-lg text-[hsl(330,80%,75%)]">
                        {formatCurrency(projectedSummary.debts)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                      Basierend auf Monatsabschluss {formatPeriod(projectedSummary.lastSnapshotPeriod)} und {monthlyTxSummary.expenseCents + monthlyTxSummary.incomeCents > 0 ? 'erfassten' : 'keinen'} Transaktionen seitdem.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-sm">
                      Noch kein abgeschlossener Monatsabschluss vorhanden.
                      Erstelle einen Snapshot, um eine laufende Projektion zu sehen.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass hover-lift">
              <CardHeader>
                <CardTitle>Laufende Monatsbilanz</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Einnahmen</span>
                    <span className="font-semibold text-lg text-[hsl(172,66%,65%)]">
                      +{formatCurrency(monthlyTxSummary.incomeCents)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ausgaben</span>
                    <span className="font-semibold text-lg text-[hsl(330,80%,75%)]">
                      -{formatCurrency(monthlyTxSummary.expenseCents)}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-bold text-xl ${monthlyTxSummary.balanceCents >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                      {formatCurrency(monthlyTxSummary.balanceCents)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Networth Chart */}
          {history.length > 0 && (
            <Card className="glass hover-lift overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Vermögensentwicklung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NetworthChart data={history} />
              </CardContent>
            </Card>
          )}

          {/* Category & Trend Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass hover-lift overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  Ausgaben nach Kategorie
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryExpenses.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">📊</span>
                    </div>
                    <p className="text-foreground mb-1">Noch keine Ausgaben</p>
                    <p className="text-muted-foreground text-sm">
                      Erfasse Transaktionen, um die Verteilung zu sehen
                    </p>
                  </div>
                ) : (
                  <CategoryChart data={categoryExpenses} />
                )}
              </CardContent>
            </Card>

            <Card className="glass hover-lift overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Ausgaben-Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spendingTrend.every((m) => m.spendCents === 0) ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">📈</span>
                    </div>
                    <p className="text-foreground mb-1">Noch keine Ausgaben</p>
                    <p className="text-muted-foreground text-sm">
                      Der Trend erscheint, sobald Transaktionen erfasst sind
                    </p>
                  </div>
                ) : (
                  <SpendingTrendChart data={spendingTrend} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly Summary */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass hover-lift">
              <CardHeader>
                <CardTitle>Monatsbilanz</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Einkommen</span>
                      <span className="font-semibold text-lg text-[hsl(172,66%,65%)]">
                        +{formatCurrency(metrics.incomeCents)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Ausgaben</span>
                      <span className="font-semibold text-lg text-[hsl(330,80%,75%)]">
                        {metrics.spendCents === null ? '—' : `-${formatCurrency(metrics.spendCents)}`}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Gespart</span>
                      <span className={`font-bold text-xl ${
                        metrics.spendCents !== null && metrics.incomeCents - metrics.spendCents < 0
                          ? 'text-[hsl(330,80%,75%)]'
                          : 'text-[hsl(172,66%,65%)]'
                      }`}>
                        {metrics.spendCents === null
                          ? '—'
                          : formatCurrency(metrics.incomeCents - metrics.spendCents)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Sparquote</span>
                      <span className={`text-2xl font-bold ${
                        metrics.savingsRate === null
                          ? 'text-muted-foreground'
                          : metrics.savingsRate >= 0.2
                            ? 'text-[hsl(172,66%,65%)]'
                            : metrics.savingsRate >= 0
                              ? 'text-[hsl(45,90%,70%)]'
                              : 'text-[hsl(330,80%,75%)]'
                      }`}>
                        {metrics.savingsRate === null ? '—' : formatPercent(metrics.savingsRate)}
                      </span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-[hsl(172,66%,65%)] progress-animate rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, (metrics.savingsRate ?? 0) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass hover-lift">
              <CardHeader>
                <CardTitle>Erfassungsgrad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="none"
                          className="text-secondary"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="url(#gradient)"
                          strokeWidth="12"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${(metrics.explainedRatio ?? 0) * 351.86} 351.86`}
                          className="progress-animate"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="hsl(262, 83%, 75%)" />
                            <stop offset="100%" stopColor="hsl(172, 66%, 65%)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute text-3xl font-bold">
                        {metrics.explainedRatio === null ? '—' : `${Math.round(metrics.explainedRatio * 100)}%`}
                      </span>
                    </div>
                  </div>

                  {metrics.explainedRatio === null || metrics.spendCents === null ? (
                    <p className="text-sm text-muted-foreground text-center">noch keine Daten</p>
                  ) : (
                    <div className="space-y-2 text-center">
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">{formatCurrency(metrics.trackedCents)}</span>
                        {' '}von{' '}
                        <span className="text-foreground font-medium">{formatCurrency(metrics.spendCents)}</span>
                        {' '}erfasst
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(metrics.spendCents - metrics.trackedCents)} nicht zugeordnet
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
