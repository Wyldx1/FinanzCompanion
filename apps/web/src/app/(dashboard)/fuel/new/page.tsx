import { db } from '@/lib/db';
import { vehicles, fuelEntries } from '@finanz/db/schema';
import { asc } from 'drizzle-orm';
import { FuelForm } from '@/components/fuel-form';

export default async function NewFuelPage() {
  const vehiclesList = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  const previousEntries = await db.query.fuelEntries.findMany({
    orderBy: [fuelEntries.date],
  });

  return (
    <div className="max-w-2xl mx-auto">
      <FuelForm vehicles={vehiclesList} previousEntries={previousEntries} />
    </div>
  );
}
