'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, FileText, HardHat } from 'lucide-react';
import { formatMinutes } from '@/lib/utils';

interface WorkTimeEntry {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  site: string | null;
  notes: string | null;
  netMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
}

interface WorkTimeReportsProps {
  entries: WorkTimeEntry[];
}

interface MonthGroup {
  period: string;
  label: string;
  entries: WorkTimeEntry[];
  netMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
}

export function WorkTimeReports({ entries }: WorkTimeReportsProps) {
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, MonthGroup>();

    for (const entry of entries) {
      const d = new Date(entry.date);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });

      if (!map.has(period)) {
        map.set(period, {
          period,
          label,
          entries: [],
          netMinutes: 0,
          targetMinutes: 0,
          overtimeMinutes: 0,
        });
      }

      const group = map.get(period)!;
      group.entries.push(entry);
      group.netMinutes += entry.netMinutes;
      group.targetMinutes += entry.targetMinutes;
      group.overtimeMinutes += entry.overtimeMinutes;
    }

    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
  }, [entries]);

  function togglePeriod(period: string) {
    const next = new Set(openPeriods);
    if (next.has(period)) {
      next.delete(period);
    } else {
      next.add(period);
    }
    setOpenPeriods(next);
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className="glass overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Baustellenberichte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((group) => {
          const isOpen = openPeriods.has(group.period);
          const isPositive = group.overtimeMinutes >= 0;

          return (
            <div
              key={group.period}
              className="rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => togglePeriod(group.period)}
                className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <HardHat className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{group.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.entries.length} Tage · Netto {formatMinutes(group.netMinutes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-sm font-semibold ${isPositive ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                    {formatMinutes(group.overtimeMinutes)}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="p-4 space-y-3 border-t border-border">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Netto</p>
                      <p className="font-semibold">{formatMinutes(group.netMinutes)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Soll</p>
                      <p className="font-semibold">{formatMinutes(group.targetMinutes)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Überstunden</p>
                      <p className={`font-semibold ${isPositive ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                        {formatMinutes(group.overtimeMinutes)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.entries
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3 rounded-lg bg-secondary/30 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">
                                {new Date(entry.date).toLocaleDateString('de-DE', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                                {entry.site && (
                                  <span className="ml-2 text-xs text-muted-foreground">· {entry.site}</span>
                                )}
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                {entry.startTime.slice(0, 5)} – {entry.endTime.slice(0, 5)}
                                {entry.breakMinutes > 0 && ` · Pause ${entry.breakMinutes} min`}
                              </p>
                              {entry.notes && (
                                <p className="text-muted-foreground mt-1 text-xs">{entry.notes}</p>
                              )}
                            </div>
                            <span className="font-semibold whitespace-nowrap">
                              {formatMinutes(entry.netMinutes)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
