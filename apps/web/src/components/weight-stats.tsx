'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Scale, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WeightEntry {
  id: number;
  date: Date;
  weightKg: number;
  notes: string | null;
}

interface WeightStatsProps {
  entries: WeightEntry[];
}

export function WeightStats({ entries }: WeightStatsProps) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const avg = sorted.reduce((sum, e) => sum + e.weightKg, 0) / sorted.length;
  const change = latest.weightKg - first.weightKg;

  const chartData = sorted.map((e) => ({
    date: new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    weight: e.weightKg,
  }));

  const minWeight = Math.min(...sorted.map((e) => e.weightKg));
  const maxWeight = Math.max(...sorted.map((e) => e.weightKg));
  const yDomainMin = Math.floor(minWeight - 1);
  const yDomainMax = Math.ceil(maxWeight + 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktuell</p>
                <p className="text-2xl font-bold mt-1">{latest.weightKg.toFixed(1)} kg</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Scale className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ø Durchschnitt</p>
                <p className="text-2xl font-bold mt-1">{avg.toFixed(1)} kg</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[hsl(210,80%,70%)]/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-[hsl(210,80%,70%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Veränderung</p>
                <p className={`text-2xl font-bold mt-1 ${change <= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)} kg
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                {change <= 0 ? <TrendingDown className="h-6 w-6 text-[hsl(172,66%,65%)]" /> : <TrendingUp className="h-6 w-6 text-[hsl(330,80%,75%)]" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">Verlauf</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <YAxis domain={[yDomainMin, yDomainMax]} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Gewicht']}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142, 71%, 45%)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
