'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Feedback {
  text: string;
  kind: 'success' | 'error';
}

/**
 * Schlankes Feedback nach Speichern/Löschen:
 * showFeedback() setzt eine Meldung, die nach 3s automatisch ausblendet.
 */
export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  return { feedback, showFeedback: setFeedback };
}

export function FeedbackToast({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;

  return (
    <div
      className={cn(
        'fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] glass rounded-lg px-4 py-3 border shadow-xl slide-in flex items-center gap-2 text-sm font-medium',
        feedback.kind === 'success'
          ? 'border-[hsl(172,66%,65%)]/30 text-[hsl(172,66%,65%)]'
          : 'border-destructive/30 text-destructive'
      )}
      role="status"
    >
      {feedback.kind === 'success' ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}
      {feedback.text}
    </div>
  );
}
