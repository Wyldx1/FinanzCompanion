'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeedbackToast, useFeedback } from '@/components/feedback-toast';
import { Pencil, Trash2, Scale } from 'lucide-react';
import Link from 'next/link';

interface WeightEntry {
  id: number;
  date: Date;
  weightKg: number;
  notes: string | null;
}

interface WeightListProps {
  entries: WeightEntry[];
}

export function WeightList({ entries }: WeightListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/weight/${id}`, {
      method: 'DELETE',
    });

    showFeedback(
      res.ok
        ? { text: 'Eintrag gelöscht', kind: 'success' }
        : { text: 'Löschen fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">⚖️</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine Gewichtseinträge</p>
        <p className="text-muted-foreground text-sm">
          Trage dein erstes Gewicht ein.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const date = new Date(entry.date).toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

        return (
          <div
            key={entry.id}
            className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-lg">{date}</p>
                <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{entry.weightKg.toFixed(1)} kg</span>
                  {entry.notes && <span>· {entry.notes}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Link href={`/weight/${entry.id}/edit`}>
                <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(entry.id)}
                className="hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Gewichtseintrag löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && handleDelete(deleteId)}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackToast feedback={feedback} />
    </div>
  );
}
