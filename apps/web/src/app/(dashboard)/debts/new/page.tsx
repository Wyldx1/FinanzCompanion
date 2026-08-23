import { redirect } from 'next/navigation';

export default function NewDebtPage() {
  redirect('/accounts/new?kind=liability');
}
