import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { fuelEntries } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { Plus, Fuel } from 'lucide-react';
import Link from 'next/link';
import { FuelList } from '@/components/fuel-list';
import { FuelStats } from '@/components/fuel-stats';

export default async function FuelPage() {
  const entries = await db.query.fuelEntries.findMany({
    with: { vehicle: true },
    orderBy: [desc(fuelEntries.date), desc(fuelEntries.createdAt)],
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Tanken</h1>
          <p className="text-muted-foreground mt-1">
            {entries.length} Tank- oder Ladevorgänge erfasst
          </p>
        </div>
        <Link href="/fuel/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Vorgang
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <FuelStats entries={entries} />

      {/* Entries List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            Alle Vorgänge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FuelList entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
