'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="destructive" onClick={handleLogout}>
      <LogOut className="mr-2 h-4 w-4" />
      Abmelden
    </Button>
  );
}
