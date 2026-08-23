import { db } from '@/lib/db';
import { vehicles } from '@finanz/db/schema';
import { asc } from 'drizzle-orm';
import { RepairForm } from '@/components/repair-form';

interface NewRepairPageProps {
  searchParams: { vehicle?: string };
}

export default async function NewRepairPage({ searchParams }: NewRepairPageProps) {
  const vehiclesList = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  const defaultVehicleId = searchParams.vehicle ? parseInt(searchParams.vehicle) : undefined;

  return (
    <div className="max-w-2xl mx-auto">
      <RepairForm vehicles={vehiclesList} defaultVehicleId={defaultVehicleId} />
    </div>
  );
}
