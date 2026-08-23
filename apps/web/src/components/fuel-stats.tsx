'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Euro, Droplets, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Vehicle {
  id: number;
  name: string;
  type: 'fuel' | 'electric';
}

interface FuelEntry {
  id: number;
  vehicleId: number;
  date: Date;
  odometerKm: number;
  quantity: number;
  pricePerUnitCents: number;
  totalCents: number;
  notes: string | null;
  vehicle: Vehicle;
}

interface Repair {
  id: number;
  vehicleId: number;
  date: Date;
  odometerKm: number | null;
  description: string;
  costCents: number;
  notes: string | null;
  vehicle: Vehicle;
}

interface FuelStatsProps {
  entries: FuelEntry[];
  repairs: Repair[];
  vehicle: Vehicle;
}

export function FuelStats({ entries, repairs, vehicle }: FuelStatsProps) {
  const totalFuelCost = entries.reduce((sum, e) => sum + e.totalCents, 0);
  const totalRepairCost = repairs.reduce((sum, r) => sum + r.costCents, 0);
  const totalCost = totalFuelCost + totalRepairCost;
  const totalQuantity = entries.reduce((sum, e) => sum + e.quantity, 0);

  // Average cost per month based on distinct months with fuel entries or repairs
  const monthsWithEntriesSet = new Set<string>();
  for (const e of entries) {
    const d = new Date(e.date);
    monthsWithEntriesSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  for (const r of repairs) {
    const d = new Date(r.date);
    monthsWithEntriesSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthsWithEntries = monthsWithEntriesSet.size;
  const avgCostPerMonth = monthsWithEntries > 0 ? totalCost / monthsWithEntries : 0;

  // Consumption for fuel vehicles
  let avgConsumption: number | null = null;
  if (vehicle.type === 'fuel') {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let totalDistance = 0;
    let totalFuelQuantity = 0;
    for (let i = 1; i < sorted.length; i++) {
      const distance = sorted[i].odometerKm - sorted[i - 1].odometerKm;
      if (distance > 0) {
        totalDistance += distance;
        totalFuelQuantity += sorted[i].quantity;
      }
    }
    avgConsumption = totalDistance > 0 ? (totalFuelQuantity / totalDistance) * 100 : null;
  }

  const stats: {
    label: string;
    value: string;
    sub: string;
    icon: typeof Euro;
    color: string;
    bg: string;
  }[] = [
    {
      label: 'Gesamtkosten',
      value: formatCurrency(totalCost),
      sub: `${formatCurrency(totalFuelCost)} Tanken · ${formatCurrency(totalRepairCost)} Reparaturen`,
      icon: Euro,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: `Ø Kosten/Monat`,
      value: formatCurrency(Math.round(avgCostPerMonth)),
      sub: monthsWithEntries > 0 ? `${monthsWithEntries} Monat(e) mit Einträgen` : 'Keine Einträge',
      icon: Calendar,
      color: 'text-[hsl(45,90%,70%)]',
      bg: 'bg-[hsl(45,90%,70%)]/10',
    },
  ];

  if (vehicle.type === 'fuel') {
    const avgPrice = totalQuantity > 0 ? totalFuelCost / totalQuantity : 0;
    stats.push({
      label: 'Ø Preis/Liter',
      value: avgPrice > 0 ? `${(avgPrice / 100).toFixed(3)} €` : '-',
      sub: 'Durchschnittspreis',
      icon: Droplets,
      color: 'text-[hsl(210,80%,70%)]',
      bg: 'bg-[hsl(210,80%,70%)]/10',
    });

    stats.push({
      label: 'Ø Verbrauch',
      value: avgConsumption !== null ? `${avgConsumption.toFixed(1)} L/100km` : '-',
      sub: 'Auf Basis Kilometerstand',
      icon: TrendingUp,
      color: 'text-[hsl(172,66%,65%)]',
      bg: 'bg-[hsl(172,66%,65%)]/10',
    });
  }

  return (
    <div className={`grid gap-4 ${stats.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{stat.label}</p>
                  <p className={`text-xl font-bold mt-1 ${stat.color} truncate`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{stat.sub}</p>
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
