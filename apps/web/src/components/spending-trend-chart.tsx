'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatCurrency, periodToDate } from '@/lib/utils';

interface TrendDatum {
  period: string;
  spendCents: number;
}

interface SpendingTrendChartProps {
  data: TrendDatum[];
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: periodToDate(d.period).toLocaleDateString('de-DE', {
      month: 'short',
      year: '2-digit',
    }),
    spendEuro: d.spendCents / 100,
  }));

  return (
    <div className="h-[220px] md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(262, 83%, 75%)" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(330, 80%, 75%)" stopOpacity={0.7} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(240, 5%, 25%)"
            strokeOpacity={0.3}
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: 'hsl(240, 5%, 55%)' }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />

          <YAxis
            tick={{ fontSize: 12, fill: 'hsl(240, 5%, 55%)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)}k`;
              }
              return value;
            }}
            dx={-10}
          />

          <Tooltip
            cursor={{ fill: 'hsl(262, 83%, 75%)', fillOpacity: 0.1 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="glass rounded-lg p-4 border border-white/10 shadow-xl">
                    <p className="text-sm font-medium text-foreground mb-2">{label}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'hsl(262, 83%, 75%)' }}
                      />
                      <span className="text-muted-foreground">Ausgaben:</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency((payload[0].value as number) * 100)}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          <Bar
            dataKey="spendEuro"
            name="Ausgaben"
            fill="url(#colorSpend)"
            radius={[6, 6, 0, 0]}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
