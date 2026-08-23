'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Scale, Calendar, FileText } from 'lucide-react';

interface WeightFormProps {
  initialData?: {
    id: number;
    date: Date;
    weightKg: number;
    notes: string | null;
  };
  isEdit?: boolean;
}

export function WeightForm({ initialData, isEdit = false }: WeightFormProps) {
  const router = useRouter();
  const [date, setDate] = useState(
    initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [weight, setWeight] = useState(
    initialData ? initialData.weightKg.toFixed(1).replace('.', ',') : ''
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function parseWeight(value: string): number | null {
    let cleaned = value.trim().replace(/\s/g, '').replace('kg', '').replace('KG', '');
    if (!cleaned) return null;
    cleaned = cleaned.replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num) || num <= 0) return null;
    return num;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const weightKg = parseWeight(weight);
    if (weightKg === null) {
      setError('Bitte ein gültiges Gewicht eingeben, z.B. 82,5');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/weight/${initialData?.id}` : '/api/weight';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          weightKg,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/weight');
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
          <Scale className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Gewicht bearbeiten' : 'Gewicht eintragen'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Eintrag anpassen' : 'Trage dein aktuelles Gewicht ein'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Weight */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Gewicht
            </label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="z.B. 82,5"
                className="h-12 pr-16 text-lg"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                kg
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
              placeholder="z.B. morgens, nüchtern"
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
