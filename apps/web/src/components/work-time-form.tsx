'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, HardHat, Clock, Calendar, MapPin, FileText } from 'lucide-react';
import { calculateWorkTime } from '@finanz/db/soka';
import { formatMinutes } from '@/lib/utils';

interface WorkTimeFormProps {
  initialData?: {
    id: number;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    site: string | null;
    notes: string | null;
  };
  isEdit?: boolean;
}

export function WorkTimeForm({ initialData, isEdit = false }: WorkTimeFormProps) {
  const router = useRouter();
  const [date, setDate] = useState(
    initialData?.date ? initialData.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState(
    initialData?.startTime ? initialData.startTime.slice(0, 5) : '07:30'
  );
  const [endTime, setEndTime] = useState(
    initialData?.endTime ? initialData.endTime.slice(0, 5) : ''
  );
  const [breakMinutes, setBreakMinutes] = useState(
    initialData?.breakMinutes ? String(initialData.breakMinutes) : '0'
  );
  const [site, setSite] = useState(initialData?.site || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    if (!startTime || !endTime || !date) return null;
    try {
      return calculateWorkTime(
        `${startTime}:00`,
        `${endTime}:00`,
        parseInt(breakMinutes || '0'),
        new Date(date)
      );
    } catch {
      return null;
    }
  }, [date, startTime, endTime, breakMinutes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const breakNum = parseInt(breakMinutes || '0');
    if (isNaN(breakNum) || breakNum < 0) {
      setError('Pause muss eine gültige Zahl sein');
      setLoading(false);
      return;
    }

    if (!date || !startTime || !endTime) {
      setError('Datum, Start- und Endzeit sind Pflicht');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/worktime/${initialData?.id}` : '/api/worktime';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
          breakMinutes: breakNum,
          site: site || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/worktime');
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
          <HardHat className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Arbeitszeit bearbeiten' : 'Arbeitszeit erfassen'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Eintrag anpassen' : 'Erfasse deinen Arbeitstag mit Baustelle und Notizen'}
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

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Start
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-12"
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Ende</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-12"
                required
              />
            </div>
          </div>

          {/* Break */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Pause (Minuten)</label>
            <Input
              type="number"
              min={0}
              step={5}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              className="h-12"
            />
          </div>

          {/* Site */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Baustelle / Ort
            </label>
            <Input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="z.B. Musterstraße 1"
              className="h-12"
            />
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Was wurde gemacht?
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. Dach decken, Gaube abdichten"
              className="h-12"
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
              <p className="text-sm font-medium">Vorschau</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nettoarbeitszeit</span>
                <span className="font-semibold">{formatMinutes(preview.netMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Soll-Zeit (SOKA-DACH)</span>
                <span className="font-semibold">{formatMinutes(preview.targetMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Überstunden</span>
                <span className={`font-semibold ${preview.overtimeMinutes >= 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                  {formatMinutes(preview.overtimeMinutes)}
                </span>
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
