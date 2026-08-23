import { AccountForm } from '@/components/account-form';

interface NewAccountPageProps {
  searchParams: { kind?: string };
}

export default function NewAccountPage({ searchParams }: NewAccountPageProps) {
  return (
    <div className="max-w-lg mx-auto">
      <AccountForm defaultKind={searchParams.kind} />
    </div>
  );
}
