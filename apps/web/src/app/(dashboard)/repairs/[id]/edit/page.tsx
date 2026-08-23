import { redirect } from 'next/navigation';

interface EditRepairPageProps {
  params: { id: string };
}

export default async function EditRepairPage({ params }: EditRepairPageProps) {
  redirect(`/fuel/${params.id}/edit`);
}
