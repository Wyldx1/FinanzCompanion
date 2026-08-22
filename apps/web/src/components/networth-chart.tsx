'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatCurrency, periodToDate } from '@/lib/utils';

interface ChartData {
  period: string;
  networth: number;
  liquid: number;
  debts: number;
}

interface NetworthChartProps {
  data: ChartData[];
}

export function NetworthChart({ data }: NetworthChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: periodToDate(d.period).toLocaleDateString('de-DE', {
      month: 'short',
      year: '2-digit',
    }),
    networthEuro: d.networth / 100,
    liquidEuro: d.liquid / 100,
    debtsEuro: d.debts / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
        <defs>
          {/* Gradient for liquid assets */}
          <linearGradient id="colorLiquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(172, 66%, 65%)" stopOpacity={0.4} />
            <stop offset="50%" stopColor="hsl(172, 66%, 65%)" stopOpacity={0.1} />
            <stop offset="100%" stopColor="hsl(172, 66%, 65%)" stopOpacity={0} />
          </linearGradient>

          {/* Gradient for networth line */}
          <linearGradient id="colorNetworth" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(262, 83%, 75%)" />
            <stop offset="50%" stopColor="hsl(172, 66%, 65%)" />
            <stop offset="100%" stopColor="hsl(330, 80%, 75%)" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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
              return `${(value / 1000).toFixed(0)}k`;
            }
            return value;
          }}
          dx={-10}
        />

        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="glass rounded-lg p-4 border border-white/10 shadow-xl">
                  <p className="text-sm font-medium text-foreground mb-2">{label}</p>
                  <div className="space-y-1">
                    {payload.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency((entry.value as number) * 100)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />

        {/* Liquid assets area */}
        <Area
          type="monotone"
          dataKey="liquidEuro"
          name="Liquide Mittel"
          stroke="hsl(172, 66%, 65%)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorLiquid)"
          animationDuration={1500}
          animationEasing="ease-out"
        />

        {/* Networth line with glow */}
        <Area
          type="monotone"
          dataKey="networthEuro"
          name="Nettovermögen"
          stroke="url(#colorNetworth)"
          strokeWidth={3}
          fill="none"
          filter="url(#glow)"
          animationDuration={2000}
          animationEasing="ease-out"
          dot={false}
          activeDot={{
            r: 6,
            fill: 'hsl(262, 83%, 75%)',
            stroke: 'hsl(240, 10%, 9%)',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
