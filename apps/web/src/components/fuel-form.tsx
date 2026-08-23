'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Fuel, Zap, Calendar, GaugeCircle, Droplets, Banknote, FileText } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

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
}

interface FuelFormProps {
  vehicles: Vehicle[];
  previousEntries?: FuelEntry[];
  initialData?: FuelEntry & { vehicle?: Vehicle };
  isEdit?: boolean;
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

function formatPrice(value: number): string {
  return (value / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function FuelForm({ vehicles, previousEntries = [], initialData, isEdit = false }: FuelFormProps) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState<number>(initialData?.vehicleId || vehicles[0]?.id || 0);
  const [date, setDate] = useState(
    initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [odometerKm, setOdometerKm] = useState(initialData?.odometerKm ? String(initialData.odometerKm) : '');
  const [quantity, setQuantity] = useState(initialData?.quantity ? String(initialData.quantity) : '');
  const [pricePerUnit, setPricePerUnit] = useState(
    initialData ? formatPrice(initialData.pricePerUnitCents) : ''
  );
  const [total, setTotal] = useState(initialData ? formatCurrency(initialData.totalCents).replace(/\s*€/, '') : '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const unitLabel = selectedVehicle?.type === 'electric' ? 'kWh' : 'Liter';
  const priceLabel = selectedVehicle?.type === 'electric' ? 'Preis pro kWh' : 'Preis pro Liter';

  const lastEntry = useMemo(() => {
    return previousEntries
      .filter((e) => e.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [previousEntries, vehicleId]);

  const consumption = useMemo(() => {
    const currentOdo = parseInt(odometerKm || '0');
    const currentQty = parseFloat(quantity || '0');
    if (!lastEntry || !currentOdo || !currentQty) return null;
    const distance = currentOdo - lastEntry.odometerKm;
    if (distance <= 0) return null;
    const consumptionValue = (currentQty / distance) * 100;
    return { distance, consumption: consumptionValue };
  }, [lastEntry, odometerKm, quantity]);

  const calculatedTotal = useMemo(() => {
    const qty = parseFloat(quantity || '0');
    const price = parsePriceToCents(pricePerUnit);
    if (!qty || price === null) return null;
    return Math.round(qty * price);
  }, [quantity, pricePerUnit]);

  function handlePriceChange(value: string) {
    setPricePerUnit(value);
    const qty = parseFloat(quantity || '0');
    const price = parsePriceToCents(value);
    if (qty && price !== null) {
      setTotal((Math.round(qty * price) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }

  function handleQuantityChange(value: string) {
    setQuantity(value);
    const qty = parseFloat(value || '0');
    const price = parsePriceToCents(pricePerUnit);
    if (qty && price !== null) {
      setTotal((Math.round(qty * price) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }

  function handleTotalChange(value: string) {
    setTotal(value);
    const totalCents = parsePriceToCents(value);
    const qty = parseFloat(quantity || '0');
    if (qty && totalCents !== null) {
      setPricePerUnit(formatPrice(Math.round(totalCents / qty)));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const odo = parseInt(odometerKm);
    const qty = parseFloat(quantity);
    const priceCents = parsePriceToCents(pricePerUnit);

    if (!vehicleId) {
      setError('Bitte ein Fahrzeug auswählen');
      setLoading(false);
      return;
    }
    if (isNaN(odo) || odo < 0) {
      setError('Bitte einen gültigen Kilometerstand eingeben');
      setLoading(false);
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setError(`Bitte eine gültige Menge in ${unitLabel} eingeben`);
      setLoading(false);
      return;
    }
    if (priceCents === null || priceCents < 0) {
      setError('Bitte einen gültigen Preis eingeben');
      setLoading(false);
      return;
    }

    const totalCents = calculatedTotal ?? Math.round(qty * priceCents);

    try {
      const url = isEdit ? `/api/fuel/${initialData?.id}` : '/api/fuel';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          date,
          odometerKm: odo,
          quantity: qty,
          pricePerUnitCents: priceCents,
          totalCents,
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
          <Fuel className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Tankvorgang bearbeiten' : 'Tankvorgang erfassen'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Eintrag anpassen' : `Erfasse ${selectedVehicle?.type === 'electric' ? 'das Laden' : 'das Tanken'} mit Kilometerstand und Menge`}
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
              Kilometerstand
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
              placeholder={lastEntry ? `Letzter: ${lastEntry.odometerKm} km` : 'z.B. 123456'}
              className="h-12"
              required
            />
            {lastEntry && (
              <p className="text-xs text-muted-foreground">
                Letzter Eintrag: {lastEntry.odometerKm} km am {new Date(lastEntry.date).toLocaleDateString('de-DE')}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Menge ({unitLabel})
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder={selectedVehicle?.type === 'electric' ? 'z.B. 45,5' : 'z.B. 42,5'}
              className="h-12"
              required
            />
          </div>

          {/* Price per unit */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              {priceLabel}
            </label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={pricePerUnit}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="z.B. 2,999"
                className="h-12 pr-16"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                EUR
              </span>
            </div>
          </div>

          {/* Total */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Gesamtbetrag</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={total}
                onChange={(e) => handleTotalChange(e.target.value)}
                placeholder="0,00"
                className="h-12 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                EUR
              </span>
            </div>
            {calculatedTotal !== null && (
              <p className="text-xs text-muted-foreground">
                Berechnet: {formatCurrency(calculatedTotal)}
              </p>
            )}
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
              placeholder="z.B. Tankstelle, Route..."
              className="h-12"
            />
          </div>

          {/* Preview */}
          {consumption && selectedVehicle?.type === 'fuel' && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
              <p className="text-sm font-medium">Verbrauchsvorschau</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Strecke seit letztem Eintrag</span>
                <span className="font-semibold">{consumption.distance} km</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Verbrauch</span>
                <span className="font-semibold">{consumption.consumption.toFixed(1)} L/100km</span>
              </div>
            </div>
          )}

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
