'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Clock, TrendingUp, Calendar } from 'lucide-react';
import { formatMinutes } from '@/lib/utils';

interface WorkTimeStatsProps {
  netMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
  label: string;
}

export function WorkTimeStats({ netMinutes, targetMinutes, overtimeMinutes, label }: WorkTimeStatsProps) {
  const isPositive = overtimeMinutes >= 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="glass hover-lift overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Nettoarbeitszeit {label}</p>
              <p className="text-2xl font-bold mt-1">{formatMinutes(netMinutes)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover-lift overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Soll-Zeit {label}</p>
              <p className="text-2xl font-bold mt-1">{formatMinutes(targetMinutes)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[hsl(210,80%,70%)]/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-[hsl(210,80%,70%)]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover-lift overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Überstunden {label}</p>
              <p className={`text-2xl font-bold mt-1 ${isPositive ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                {formatMinutes(overtimeMinutes)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-[hsl(172,66%,65%)]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
