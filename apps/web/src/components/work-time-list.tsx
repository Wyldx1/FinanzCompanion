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
import { Pencil, Trash2, HardHat, Clock } from 'lucide-react';
import { formatMinutes } from '@/lib/utils';
import Link from 'next/link';

interface WorkTimeEntry {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  site: string | null;
  notes: string | null;
  netMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
}

interface WorkTimeListProps {
  entries: WorkTimeEntry[];
}

export function WorkTimeList({ entries }: WorkTimeListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/worktime/${id}`, {
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
          <span className="text-4xl">🦺</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine Arbeitszeiten</p>
        <p className="text-muted-foreground text-sm">
          Trage deinen ersten Arbeitstag ein.
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
        const isPositive = entry.overtimeMinutes >= 0;

        return (
          <div
            key={entry.id}
            className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                  <HardHat className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-lg">{date}</p>
                    {entry.site && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full truncate max-w-[200px]">
                        {entry.site}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {entry.startTime.slice(0, 5)} – {entry.endTime.slice(0, 5)}
                    </span>
                    {entry.breakMinutes > 0 && (
                      <span>Pause {entry.breakMinutes} min</span>
                    )}
                  </div>

                  {entry.notes && (
                    <p className="text-sm text-muted-foreground mt-2 truncate">{entry.notes}</p>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Netto</p>
                      <p className="font-semibold">{formatMinutes(entry.netMinutes)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Soll</p>
                      <p className="font-semibold">{formatMinutes(entry.targetMinutes)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground">Überstunden</p>
                      <p className={`font-semibold ${isPositive ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                        {formatMinutes(entry.overtimeMinutes)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Link href={`/worktime/${entry.id}/edit`}>
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
          </div>
        );
      })}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Eintrag löschen?</DialogTitle>
            <DialogDescription>
              Diese Arbeitszeit wird entfernt. Berechnete Stunden und Überstunden werden neu ausgewiesen.
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
