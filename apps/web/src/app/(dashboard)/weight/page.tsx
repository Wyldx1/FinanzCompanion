import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { weightEntries } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { Plus, Scale } from 'lucide-react';
import Link from 'next/link';
import { WeightList } from '@/components/weight-list';
import { WeightStats } from '@/components/weight-stats';

export default async function WeightPage() {
  const entries = await db.query.weightEntries.findMany({
    orderBy: [desc(weightEntries.date), desc(weightEntries.createdAt)],
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Gewicht</h1>
          <p className="text-muted-foreground mt-1">
            {entries.length} Eintrag{entries.length !== 1 && 'e'} erfasst
          </p>
        </div>
        <Link href="/weight/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Eintrag
          </Button>
        </Link>
      </div>

      {/* Stats & Chart */}
      <WeightStats entries={entries} />

      {/* Entries List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Alle Einträge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeightList entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
