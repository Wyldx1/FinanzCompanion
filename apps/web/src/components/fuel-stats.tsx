'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Fuel, TrendingUp, Euro, Droplets } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface FuelEntry {
  id: number;
  vehicleId: number;
  date: Date;
  odometerKm: number;
  quantity: number;
  pricePerUnitCents: number;
  totalCents: number;
  notes: string | null;
  vehicle: {
    id: number;
    name: string;
    type: 'fuel' | 'electric';
  };
}

interface FuelStatsProps {
  entries: FuelEntry[];
}

export function FuelStats({ entries }: FuelStatsProps) {
  if (entries.length === 0) return null;

  const totalSpent = entries.reduce((sum, e) => sum + e.totalCents, 0);
  const totalQuantity = entries.reduce((sum, e) => sum + e.quantity, 0);
  const avgPrice = totalQuantity > 0 ? totalSpent / totalQuantity : 0;

  // Calculate consumption for fuel vehicles with distance
  const fuelEntries = entries
    .filter((e) => e.vehicle.type === 'fuel')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalDistance = 0;
  let totalFuelQuantity = 0;
  for (let i = 1; i < fuelEntries.length; i++) {
    const distance = fuelEntries[i].odometerKm - fuelEntries[i - 1].odometerKm;
    if (distance > 0) {
      totalDistance += distance;
      totalFuelQuantity += fuelEntries[i].quantity;
    }
  }
  const avgConsumption = totalDistance > 0 ? (totalFuelQuantity / totalDistance) * 100 : null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="glass hover-lift overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gesamtkosten</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Euro className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover-lift overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Menge gesamt</p>
              <p className="text-2xl font-bold mt-1">{totalQuantity.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[hsl(210,80%,70%)]/10 flex items-center justify-center">
              <Droplets className="h-6 w-6 text-[hsl(210,80%,70%)]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover-lift overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ø Verbrauch</p>
              <p className="text-2xl font-bold mt-1">
                {avgConsumption !== null ? `${avgConsumption.toFixed(1)} L/100km` : '-'}
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
