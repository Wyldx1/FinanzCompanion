'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FuelList } from '@/components/fuel-list';
import { RepairList } from '@/components/repair-list';
import { FuelStats } from '@/components/fuel-stats';
import { Plus, Fuel, Wrench } from 'lucide-react';

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

interface FuelDashboardProps {
  entries: FuelEntry[];
  repairs: Repair[];
  vehicles: Vehicle[];
}

export function FuelDashboard({ entries, repairs, vehicles }: FuelDashboardProps) {
  const [activeVehicle, setActiveVehicle] = useState<string>(
    vehicles.length > 0 ? String(vehicles[0].id) : ''
  );

  const activeVehicleData = vehicles.find((v) => String(v.id) === activeVehicle);

  const filteredEntries = useMemo(
    () => entries.filter((e) => String(e.vehicleId) === activeVehicle),
    [entries, activeVehicle]
  );

  const filteredRepairs = useMemo(
    () => repairs.filter((r) => String(r.vehicleId) === activeVehicle),
    [repairs, activeVehicle]
  );

  if (vehicles.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Tanken</h1>
          <p className="text-muted-foreground mt-1">Keine Fahrzeuge vorhanden</p>
        </div>
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Lege zuerst Fahrzeuge in den Einstellungen an.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Tanken & Reparaturen</h1>
          <p className="text-muted-foreground mt-1">
            {entries.length} Tankvorgänge · {repairs.length} Reparaturen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/fuel/new?vehicle=${activeVehicle}`}>
            <Button className="glow hover-lift">
              <Plus className="mr-2 h-4 w-4" />
              Tanken
            </Button>
          </Link>
          <Link href={`/fuel/new-repair?vehicle=${activeVehicle}`}>
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Reparatur
            </Button>
          </Link>
        </div>
      </div>

      {/* Vehicle Tabs */}
      <Tabs value={activeVehicle} onValueChange={setActiveVehicle} className="space-y-6">
        <TabsList className="glass border border-white/10 p-1">
          {vehicles.map((vehicle) => (
            <TabsTrigger
              key={vehicle.id}
              value={String(vehicle.id)}
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              {vehicle.type === 'electric' ? '⚡' : '⛽'} {vehicle.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {vehicles.map((vehicle) => (
          <TabsContent key={vehicle.id} value={String(vehicle.id)} className="space-y-6">
            <FuelStats
              entries={filteredEntries}
              repairs={filteredRepairs}
              vehicle={vehicle}
            />

            <div className="space-y-6">
              <Card className="glass overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fuel className="h-5 w-5 text-primary" />
                    Tankvorgänge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FuelList entries={filteredEntries} vehicle={vehicle} vehicles={vehicles} />
                </CardContent>
              </Card>

              <Card className="glass overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-[hsl(45,90%,70%)]" />
                    Reparaturen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RepairList repairs={filteredRepairs} vehicle={vehicle} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
