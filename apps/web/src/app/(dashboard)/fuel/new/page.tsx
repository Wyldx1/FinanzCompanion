import { db } from '@/lib/db';
import { vehicles, fuelEntries } from '@finanz/db/schema';
import { asc } from 'drizzle-orm';
import { FuelForm } from '@/components/fuel-form';

interface NewFuelPageProps {
  searchParams: { vehicle?: string };
}

export default async function NewFuelPage({ searchParams }: NewFuelPageProps) {
  const vehiclesList = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  const previousEntries = await db.query.fuelEntries.findMany({
    orderBy: [fuelEntries.date],
  });

  const defaultVehicleId = searchParams.vehicle ? parseInt(searchParams.vehicle) : undefined;

  return (
    <div className="max-w-2xl mx-auto">
      <FuelForm
        vehicles={vehiclesList}
        previousEntries={previousEntries}
        defaultVehicleId={defaultVehicleId}
      />
    </div>
  );
}
