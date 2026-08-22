import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { snapshots } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { calculateNetworth } from '@/lib/calculations';
import Link from 'next/link';
import { CheckCircle, Clock, XCircle, CalendarDays, TrendingUp, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default async function HistoryPage() {
  const allSnapshots = await db.query.snapshots.findMany({
    orderBy: [desc(snapshots.period)],
  });

  const enrichedSnapshots = await Promise.all(
    allSnapshots.map(async (s, index, arr) => {
      const nw = await calculateNetworth(s.period);
      const prevSnapshot = arr[index + 1];
      let prevNetworth = 0;
      if (prevSnapshot) {
        const prevNw = await calculateNetworth(prevSnapshot.period);
        prevNetworth = prevNw.networth;
      }
      return {
        ...s,
        networth: nw.networth,
        liquid: nw.liquid,
        debts: nw.debts,
        change: nw.networth - prevNetworth,
        changePercent: prevNetworth !== 0 ? ((nw.networth - prevNetworth) / Math.abs(prevNetworth)) * 100 : 0,
      };
    })
  );

  const totalMonths = enrichedSnapshots.length;
  const completeMonths = enrichedSnapshots.filter(s => s.status === 'complete').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Historie</h1>
          <p className="text-muted-foreground mt-1">
            {totalMonths} Monate erfasst · {completeMonths} abgeschlossen
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {enrichedSnapshots.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktuelles Vermögen</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(enrichedSnapshots[0]?.networth || 0)}
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
                  <p className="text-sm text-muted-foreground">Gesamtwachstum</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    (enrichedSnapshots[0]?.networth || 0) - (enrichedSnapshots[enrichedSnapshots.length - 1]?.networth || 0) >= 0
                      ? 'text-[hsl(172,66%,65%)]'
                      : 'text-[hsl(330,80%,75%)]'
                  }`}>
                    {enrichedSnapshots.length > 1
                      ? formatCurrency((enrichedSnapshots[0]?.networth || 0) - (enrichedSnapshots[enrichedSnapshots.length - 1]?.networth || 0))
                      : '-'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-[hsl(172,66%,65%)]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tracking seit</p>
                  <p className="text-2xl font-bold mt-1">
                    {enrichedSnapshots.length > 0
                      ? formatPeriod(enrichedSnapshots[enrichedSnapshots.length - 1].period)
                      : '-'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(210,80%,70%)]/10 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-[hsl(210,80%,70%)]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Snapshots List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Alle Monatsabschlüsse
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrichedSnapshots.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CalendarDays className="h-10 w-10 text-primary" />
              </div>
              <p className="text-lg text-foreground mb-2">Keine Historie</p>
              <p className="text-muted-foreground text-sm mb-6">
                Erstelle deinen ersten Monatsabschluss
              </p>
              <Link href="/snapshot/new">
                <Button className="glow">Jetzt starten</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {enrichedSnapshots.map((s, index) => {
                const StatusIcon = statusConfig[s.status].icon;
                const isPositiveChange = s.change >= 0;

                return (
                  <Link
                    key={s.id}
                    href={`/snapshot/${s.period}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in group"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusConfig[s.status].bg}`}>
                        <StatusIcon className={`h-6 w-6 ${statusConfig[s.status].color}`} />
                      </div>
                      <div>
                        <p className="font-semibold">{formatPeriod(s.period)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[s.status].bg} ${statusConfig[s.status].color}`}>
                            {statusConfig[s.status].label}
                          </span>
                          {s.note && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {s.note}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(s.networth)}</p>
                        {index < enrichedSnapshots.length - 1 && (
                          <p className={`text-sm ${isPositiveChange ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                            {isPositiveChange ? '+' : ''}{formatCurrency(s.change)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
