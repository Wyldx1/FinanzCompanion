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
import { Pencil, Trash2, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface Vehicle {
  id: number;
  name: string;
  type: 'fuel' | 'electric';
}

interface Repair {
  id: number;
  vehicleId: number;
  date: Date;
  odometerKm: number | null;
  description: string;
  costCents: number;
  notes: string | null;
  vehicle: Vehicle;
}

interface RepairListProps {
  repairs: Repair[];
  vehicle: Vehicle;
}

export function RepairList({ repairs, vehicle }: RepairListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/repairs/${id}`, {
      method: 'DELETE',
    });

    showFeedback(
      res.ok
        ? { text: 'Reparatur gelöscht', kind: 'success' }
        : { text: 'Löschen fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  if (repairs.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-[hsl(45,90%,70%)]/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔧</span>
        </div>
        <p className="text-foreground mb-1">Keine Reparaturen</p>
        <p className="text-muted-foreground text-sm">
          Erfasse deine erste Reparatur für {vehicle.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {repairs.map((repair, index) => {
        const date = new Date(repair.date).toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

        return (
          <div
            key={repair.id}
            className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
            style={{ animationDelay: `${index * 0.03}s` }}
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[hsl(45,90%,70%)]/10 flex items-center justify-center text-2xl flex-shrink-0">
                🔧
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{repair.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm text-muted-foreground">
                  <span>{date}</span>
                  {repair.odometerKm && <span>{repair.odometerKm.toLocaleString('de-DE')} km</span>}
                  {repair.notes && <span>· {repair.notes}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <p className="font-bold text-lg whitespace-nowrap">
                {formatCurrency(repair.costCents)}
              </p>

              <div className="flex items-center gap-1">
                <Link href={`/repairs/${repair.id}/edit`}>
                  <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(repair.id)}
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
            <DialogTitle>Reparatur löschen?</DialogTitle>
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
