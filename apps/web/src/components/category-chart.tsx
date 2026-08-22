'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface CategoryDatum {
  name: string;
  icon: string | null;
  totalCents: number;
}

interface CategoryChartProps {
  data: CategoryDatum[];
}

// Pastel-Farben passend zu den --pastel-* Tokens aus globals.css
const PASTEL_COLORS = [
  'hsl(262, 83%, 75%)',
  'hsl(172, 66%, 65%)',
  'hsl(330, 80%, 75%)',
  'hsl(210, 80%, 70%)',
  'hsl(45, 90%, 70%)',
  'hsl(25, 90%, 70%)',
];

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    totalEuro: d.totalCents / 100,
  }));
  const totalCents = data.reduce((sum, d) => sum + d.totalCents, 0);

  return (
    <div className="h-[260px] md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="totalEuro"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={3}
            strokeWidth={0}
            animationDuration={1200}
            animationEasing="ease-out"
          >
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={PASTEL_COLORS[index % PASTEL_COLORS.length]}
              />
            ))}
          </Pie>

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const entry = payload[0].payload as CategoryDatum & { totalEuro: number };
                const share = totalCents > 0 ? entry.totalCents / totalCents : 0;
                return (
                  <div className="glass rounded-lg p-4 border border-white/10 shadow-xl">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {entry.icon ? `${entry.icon} ` : ''}{entry.name}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(entry.totalCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(share * 100).toFixed(1)} % der Ausgaben
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
