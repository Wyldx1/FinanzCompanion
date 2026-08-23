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
import { Pencil, Trash2, Fuel, Zap } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface Vehicle {
  id: number;
  name: string;
  type: 'fuel' | 'electric';
}

interface FuelEntry {
  id: number;
  vehicleId: number;
  date: Date;
  odometerKm: number;
  quantity: number;
  pricePerUnitCents: number;
  totalCents: number;
  notes: string | null;
  vehicle: Vehicle;
}

interface FuelListProps {
  entries: FuelEntry[];
}

export function FuelList({ entries }: FuelListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/fuel/${id}`, {
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
          <span className="text-4xl">⛽</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine Tankvorgänge</p>
        <p className="text-muted-foreground text-sm">
          Erfasse deinen ersten Tank- oder Ladevorgang.
        </p>
      </div>
    );
  }

  // Group by vehicle
  const grouped = entries.reduce((acc, entry) => {
    const vehicleName = entry.vehicle.name;
    if (!acc[vehicleName]) acc[vehicleName] = [];
    acc[vehicleName].push(entry);
    return acc;
  }, {} as Record<string, FuelEntry[]>);

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([vehicleName, vehicleEntries]) => (
        <div key={vehicleName}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-2 flex items-center gap-2">
            {vehicleEntries[0]?.vehicle.type === 'electric' ? <Zap className="h-4 w-4" /> : <Fuel className="h-4 w-4" />}
            {vehicleName}
          </h3>
          <div className="space-y-2">
            {vehicleEntries.map((entry, index) => {
              const date = new Date(entry.date).toLocaleDateString('de-DE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              const unitLabel = entry.vehicle.type === 'electric' ? 'kWh' : 'L';
              const isElectric = entry.vehicle.type === 'electric';

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                      {isElectric ? '⚡' : '⛽'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{date}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm text-muted-foreground">
                        <span>{entry.odometerKm.toLocaleString('de-DE')} km</span>
                        <span>{entry.quantity.toFixed(2)} {unitLabel}</span>
                        <span>{(entry.pricePerUnitCents / 100).toFixed(3)} €/{unitLabel}</span>
                        {entry.notes && <span>· {entry.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <p className="font-bold text-lg whitespace-nowrap">
                      {formatCurrency(entry.totalCents)}
                    </p>

                    <div className="flex items-center gap-1">
                      <Link href={`/fuel/${entry.id}/edit`}>
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
          </div>
        </div>
      ))}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Tankvorgang löschen?</DialogTitle>
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
