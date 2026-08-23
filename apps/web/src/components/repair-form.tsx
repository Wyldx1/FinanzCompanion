'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Wrench, Calendar, GaugeCircle, Banknote, FileText, Zap, Fuel } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

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
}

interface RepairFormProps {
  vehicles: Vehicle[];
  initialData?: Repair;
  isEdit?: boolean;
  defaultVehicleId?: number;
}

function parsePriceToCents(value: string): number | null {
  let cleaned = value.trim().toLowerCase().replace(/\s/g, '').replace('€', '');
  if (!cleaned) return null;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

export function RepairForm({ vehicles, initialData, isEdit = false, defaultVehicleId }: RepairFormProps) {
  const router = useRouter();
  const initialVehicleId = initialData?.vehicleId || defaultVehicleId;
  const [vehicleId, setVehicleId] = useState<number>(
    vehicles.find((v) => v.id === initialVehicleId)?.id || vehicles[0]?.id || 0
  );
  const [date, setDate] = useState(
    initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [odometerKm, setOdometerKm] = useState(initialData?.odometerKm ? String(initialData.odometerKm) : '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [cost, setCost] = useState(initialData ? formatCurrency(initialData.costCents).replace(/\s*€/, '') : '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const costCents = parsePriceToCents(cost);
    const odo = odometerKm ? parseInt(odometerKm) : null;

    if (!vehicleId) {
      setError('Bitte ein Fahrzeug auswählen');
      setLoading(false);
      return;
    }
    if (!description.trim()) {
      setError('Bitte eine Beschreibung eingeben');
      setLoading(false);
      return;
    }
    if (costCents === null || costCents < 0) {
      setError('Bitte einen gültigen Betrag eingeben');
      setLoading(false);
      return;
    }
    if (odo !== null && (isNaN(odo) || odo < 0)) {
      setError('Bitte einen gültigen Kilometerstand eingeben');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/repairs/${initialData?.id}` : '/api/repairs';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          date,
          odometerKm: odo,
          description: description.trim(),
          costCents,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/fuel');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass gradient-border overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wrench className="h-5 w-5 text-[hsl(45,90%,70%)]" />
          <CardTitle>{isEdit ? 'Reparatur bearbeiten' : 'Reparatur erfassen'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Eintrag anpassen' : 'Erfasse Wartung oder Reparatur mit Kosten'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Fahrzeug</label>
            <div className="flex flex-wrap gap-2">
              {vehicles.map((vehicle) => {
                const Icon = vehicle.type === 'electric' ? Zap : Fuel;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setVehicleId(vehicle.id)}
                    className={cn(
                      'px-4 py-3 rounded-xl border-2 transition-all duration-300 flex items-center gap-2',
                      vehicleId === vehicle.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{vehicle.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Datum
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12"
              required
            />
          </div>

          {/* Odometer */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GaugeCircle className="h-4 w-4" />
              Kilometerstand (optional)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
              placeholder="z.B. 123456"
              className="h-12"
            />
          </div>

          {/* Description */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Beschreibung
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Bremsen vorne, Ölwechsel, Reifenwechsel"
              className="h-12"
              required
            />
          </div>

          {/* Cost */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Kosten
            </label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="z.B. 249,50"
                className="h-12 pr-16"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                EUR
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notiz (optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. Werkstatt, Materialien..."
              className="h-12"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 glow">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {isEdit ? 'Speichern' : 'Eintragen'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
