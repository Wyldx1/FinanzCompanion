import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { vehicles, fuelEntries } from '@finanz/db/schema';
import { asc, eq } from 'drizzle-orm';
import { FuelForm } from '@/components/fuel-form';

interface EditFuelPageProps {
  params: { id: string };
}

export default async function EditFuelPage({ params }: EditFuelPageProps) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const entry = await db.query.fuelEntries.findFirst({
    where: eq(fuelEntries.id, id),
    with: { vehicle: true },
  });

  if (!entry) notFound();

  const vehiclesList = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  const previousEntries = await db.query.fuelEntries.findMany({
    where: eq(fuelEntries.vehicleId, entry.vehicleId),
    orderBy: [fuelEntries.date],
  });

  return (
    <div className="max-w-2xl mx-auto">
      <FuelForm
        vehicles={vehiclesList}
        previousEntries={previousEntries}
        initialData={entry}
        isEdit
      />
    </div>
  );
}
