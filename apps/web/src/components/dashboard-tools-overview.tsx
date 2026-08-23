'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Fuel, Zap, HardHat, Scale, Wrench, TrendingUp, Droplets, Calendar } from 'lucide-react';
import { formatCurrency, formatMinutes } from '@/lib/utils';
import Link from 'next/link';

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
  vehicle: Vehicle;
}

interface Repair {
  id: number;
  vehicleId: number;
  date: Date;
  costCents: number;
  description: string;
  vehicle: Vehicle;
}

interface WorkTimeEntry {
  date: Date;
  netMinutes: number;
  overtimeMinutes: number;
}

interface WeightEntry {
  date: Date;
  weightKg: number;
}

interface DashboardToolsOverviewProps {
  fuelEntries: FuelEntry[];
  repairs: Repair[];
  workTimeEntries: WorkTimeEntry[];
  weightEntries: WeightEntry[];
}

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

export function DashboardToolsOverview({
  fuelEntries,
  repairs,
  workTimeEntries,
  weightEntries,
}: DashboardToolsOverviewProps) {
  const now = new Date();

  // Work time this week
  const weekRange = getWeekRange(now);
  const weekWork = workTimeEntries
    .filter((e) => {
      const d = new Date(e.date);
      return d >= weekRange.start && d < weekRange.end;
    })
    .reduce(
      (acc, e) => ({
        netMinutes: acc.netMinutes + e.netMinutes,
        overtimeMinutes: acc.overtimeMinutes + e.overtimeMinutes,
      }),
      { netMinutes: 0, overtimeMinutes: 0 }
    );

  // Weight
  const sortedWeights = [...weightEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latestWeight = sortedWeights[0];

  const last7DaysWeights = sortedWeights.filter((e) => {
    const d = new Date(e.date);
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  const avgWeight =
    last7DaysWeights.length > 0
      ? last7DaysWeights.reduce((sum, e) => sum + e.weightKg, 0) / last7DaysWeights.length
      : null;

  // Fuel per vehicle
  const vehiclesMap = new Map<number, Vehicle>();
  for (const entry of fuelEntries) {
    vehiclesMap.set(entry.vehicleId, entry.vehicle);
  }

  const monthRange = getMonthRange(now);
  const monthFuelCost = fuelEntries
    .filter((e) => {
      const d = new Date(e.date);
      return d >= monthRange.start && d < monthRange.end;
    })
    .reduce((sum, e) => sum + e.totalCents, 0);

  const monthRepairCost = repairs
    .filter((r) => {
      const d = new Date(r.date);
      return d >= monthRange.start && d < monthRange.end;
    })
    .reduce((sum, r) => sum + r.costCents, 0);

  const vehicleSummaries = Array.from(vehiclesMap.values()).map((vehicle) => {
    const entries = fuelEntries.filter((e) => e.vehicleId === vehicle.id);
    const totalCents = entries.reduce((sum, e) => sum + e.totalCents, 0);
    const totalQuantity = entries.reduce((sum, e) => sum + e.quantity, 0);
    const avgPrice = totalQuantity > 0 ? totalCents / totalQuantity : 0;

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

    const latestEntry = entries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    return { vehicle, totalCents, avgPrice, avgConsumption, latestEntry };
  });

  const hasAnyData =
    workTimeEntries.length > 0 ||
    weightEntries.length > 0 ||
    fuelEntries.length > 0 ||
    repairs.length > 0;

  if (!hasAnyData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Tools & Übersicht
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Work time */}
        {workTimeEntries.length > 0 && (
          <Link href="/worktime">
            <Card className="glass hover-lift overflow-hidden h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">Arbeitszeit diese Woche</p>
                    <p className="text-xl font-bold mt-1 truncate">{formatMinutes(weekWork.netMinutes)}</p>
                    <p className={`text-xs mt-1 truncate ${weekWork.overtimeMinutes >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                      {formatMinutes(weekWork.overtimeMinutes)} Überstunden
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <HardHat className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Weight */}
        {weightEntries.length > 0 && (
          <Link href="/weight">
            <Card className="glass hover-lift overflow-hidden h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">Gewicht</p>
                    <p className="text-xl font-bold mt-1 truncate">
                      {latestWeight ? `${latestWeight.weightKg.toFixed(1)} kg` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {avgWeight !== null ? `Ø 7 Tage: ${avgWeight.toFixed(1)} kg` : 'Keine Daten'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[hsl(210,80%,70%)]/10 flex items-center justify-center flex-shrink-0">
                    <Scale className="h-6 w-6 text-[hsl(210,80%,70%)]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Fuel / Vehicles */}
        {vehicleSummaries.map((summary) => {
          const Icon = summary.vehicle.type === 'electric' ? Zap : Fuel;
          return (
            <Link key={summary.vehicle.id} href="/fuel">
              <Card className="glass hover-lift overflow-hidden h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{summary.vehicle.name}</p>
                      <p className="text-xl font-bold mt-1 truncate">
                        {summary.avgConsumption !== null
                          ? `${summary.avgConsumption.toFixed(1)} L/100km`
                          : summary.avgPrice > 0
                            ? `${(summary.avgPrice / 100).toFixed(3)} €/${summary.vehicle.type === 'electric' ? 'kWh' : 'L'}`
                            : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {formatCurrency(summary.totalCents)} gesamt
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-[hsl(172,66%,65%)]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {/* Monthly vehicle costs */}
        {(fuelEntries.length > 0 || repairs.length > 0) && (
          <Link href="/fuel">
            <Card className="glass hover-lift overflow-hidden h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">Fahrzeugkosten {now.toLocaleDateString('de-DE', { month: 'short' })}</p>
                    <p className="text-xl font-bold mt-1 truncate">{formatCurrency(monthFuelCost + monthRepairCost)}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {formatCurrency(monthFuelCost)} Tanken · {formatCurrency(monthRepairCost)} Reparaturen
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[hsl(45,90%,70%)]/10 flex items-center justify-center flex-shrink-0">
                    <Wrench className="h-6 w-6 text-[hsl(45,90%,70%)]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
