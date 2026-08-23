'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Wallet, Repeat } from 'lucide-react';
import { formatCurrency, getCurrentPeriod } from '@/lib/utils';

interface RecurringExpense {
  id: number;
  name: string;
  amountCents: number;
  direction: 'expense' | 'income' | 'transfer';
  dayOfMonth: number;
  startPeriod: string;
  endPeriod: string | null;
  active: boolean;
  category: { id: number; name: string; icon: string | null } | null;
  account: { id: number; name: string; icon: string | null } | null;
}

interface RecurringExpenseStatsProps {
  items: RecurringExpense[];
}

function isActiveInPeriod(item: RecurringExpense, period: string): boolean {
  if (!item.active) return false;
  if (period < item.startPeriod) return false;
  if (item.endPeriod && period > item.endPeriod) return false;
  return true;
}

export function RecurringExpenseStats({ items }: RecurringExpenseStatsProps) {
  const currentPeriod = getCurrentPeriod();

  const activeItems = items.filter((i) => isActiveInPeriod(i, currentPeriod));

  const income = activeItems
    .filter((i) => i.direction === 'income')
    .reduce((sum, i) => sum + i.amountCents, 0);
  const expense = activeItems
    .filter((i) => i.direction === 'expense')
    .reduce((sum, i) => sum + i.amountCents, 0);
  const balance = income - expense;

  const stats = [
    {
      label: 'Monatliche Ausgaben',
      value: formatCurrency(expense),
      icon: TrendingDown,
      color: 'text-[hsl(330,80%,75%)]',
      bg: 'bg-[hsl(330,80%,75%)]/10',
    },
    {
      label: 'Monatliche Einnahmen',
      value: formatCurrency(income),
      icon: TrendingUp,
      color: 'text-[hsl(172,66%,65%)]',
      bg: 'bg-[hsl(172,66%,65%)]/10',
    },
    {
      label: 'Netto pro Monat',
      value: formatCurrency(balance),
      icon: Wallet,
      color: balance >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]',
      bg: balance >= 0 ? 'bg-[hsl(172,66%,65%)]/10' : 'bg-[hsl(330,80%,75%)]/10',
    },
    {
      label: 'Aktive Daueraufträge',
      value: `${activeItems.length}`,
      icon: Repeat,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{stat.label}</p>
                  <p className={`text-xl font-bold mt-1 truncate ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
