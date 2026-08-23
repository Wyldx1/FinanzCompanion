import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { vehicles, repairs } from '@finanz/db/schema';
import { asc, eq } from 'drizzle-orm';
import { RepairForm } from '@/components/repair-form';

interface EditRepairPageProps {
  params: { id: string };
}

export default async function EditRepairPage({ params }: EditRepairPageProps) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const repair = await db.query.repairs.findFirst({
    where: eq(repairs.id, id),
  });

  if (!repair) notFound();

  const vehiclesList = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  return (
    <div className="max-w-2xl mx-auto">
      <RepairForm vehicles={vehiclesList} initialData={repair} isEdit />
    </div>
  );
}
