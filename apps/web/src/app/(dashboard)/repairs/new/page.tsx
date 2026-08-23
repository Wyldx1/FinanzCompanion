import { redirect } from 'next/navigation';

interface NewRepairPageProps {
  searchParams: { vehicle?: string };
}

export default async function NewRepairPage({ searchParams }: NewRepairPageProps) {
  const query = searchParams.vehicle ? `?vehicle=${encodeURIComponent(searchParams.vehicle)}` : '';
  redirect(`/fuel/new-repair${query}`);
}
