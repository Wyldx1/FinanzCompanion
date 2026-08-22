'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

interface CoachActionsProps {
  canRequest: boolean;
  period: string;
}

export function CoachActions({ canRequest, period }: CoachActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRequestCoaching() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Anfordern');
        return;
      }

      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={handleRequestCoaching}
        disabled={!canRequest || loading}
        className="glow hover-lift"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Analysiere...' : 'Coaching anfordern'}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
