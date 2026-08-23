import { db } from '@/lib/db';
import { fuelEntries, repairs, vehicles } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { FuelDashboard } from '@/components/fuel-dashboard';

export default async function FuelPage() {
  const [allEntries, allRepairs, allVehicles] = await Promise.all([
    db.query.fuelEntries.findMany({
      with: { vehicle: true },
      orderBy: [desc(fuelEntries.date), desc(fuelEntries.createdAt)],
    }),
    db.query.repairs.findMany({
      with: { vehicle: true },
      orderBy: [desc(repairs.date), desc(repairs.createdAt)],
    }),
    db.query.vehicles.findMany({
      orderBy: [vehicles.sortOrder],
    }),
  ]);

  return (
    <FuelDashboard
      entries={allEntries}
      repairs={allRepairs}
      vehicles={allVehicles}
    />
  );
}
