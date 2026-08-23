import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { workTimeEntries } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { Plus, HardHat, Download } from 'lucide-react';
import { formatMinutes } from '@/lib/utils';
import Link from 'next/link';
import { WorkTimeList } from '@/components/work-time-list';
import { WorkTimeStats } from '@/components/work-time-stats';

function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function getYearRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear() + 1, 0, 1);
  return { start, end };
}

interface WorkTimeEntry {
  date: Date;
  netMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
}

function sumStats(entries: WorkTimeEntry[], start: Date, end: Date) {
  return entries
    .filter((e) => {
      const d = new Date(e.date);
      return d >= start && d < end;
    })
    .reduce(
      (acc, e) => ({
        netMinutes: acc.netMinutes + e.netMinutes,
        targetMinutes: acc.targetMinutes + e.targetMinutes,
        overtimeMinutes: acc.overtimeMinutes + e.overtimeMinutes,
      }),
      { netMinutes: 0, targetMinutes: 0, overtimeMinutes: 0 }
    );
}

export default async function WorkTimePage() {
  const entries = await db.query.workTimeEntries.findMany({
    orderBy: [desc(workTimeEntries.date), desc(workTimeEntries.createdAt)],
  });

  const now = new Date();
  const weekStats = sumStats(entries, ...Object.values(getWeekRange(now)) as [Date, Date]);
  const monthStats = sumStats(entries, ...Object.values(getMonthRange(now)) as [Date, Date]);
  const yearStats = sumStats(entries, ...Object.values(getYearRange(now)) as [Date, Date]);

  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = String(now.getFullYear());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Arbeitszeit</h1>
          <p className="text-muted-foreground mt-1">
            {entries.length} Tage erfasst
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/api/worktime/export?period=${currentPeriod}`}>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Monat
            </Button>
          </Link>
          <Link href={`/api/worktime/export?year=${currentYear}`}>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Jahr
            </Button>
          </Link>
          <Link href="/worktime/new">
            <Button className="glow hover-lift">
              <Plus className="mr-2 h-4 w-4" />
              Neuer Tag
            </Button>
          </Link>
        </div>
      </div>

      {/* Weekly Stats */}
      <WorkTimeStats
        netMinutes={weekStats.netMinutes}
        targetMinutes={weekStats.targetMinutes}
        overtimeMinutes={weekStats.overtimeMinutes}
        label="diese Woche"
      />

      {/* Monthly / Yearly Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass hover-lift">
          <CardHeader>
            <CardTitle className="text-base">Monatssaldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-semibold">{formatMinutes(monthStats.netMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Soll</span>
                <span className="font-semibold">{formatMinutes(monthStats.targetMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Überstunden</span>
                <span className={`font-semibold ${monthStats.overtimeMinutes >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                  {formatMinutes(monthStats.overtimeMinutes)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover-lift">
          <CardHeader>
            <CardTitle className="text-base">Jahressaldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-semibold">{formatMinutes(yearStats.netMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Soll</span>
                <span className="font-semibold">{formatMinutes(yearStats.targetMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Überstunden</span>
                <span className={`font-semibold ${yearStats.overtimeMinutes >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                  {formatMinutes(yearStats.overtimeMinutes)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            Alle Einträge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkTimeList entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
