'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function BackupImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setStatus(null);
  }

  async function handleImport() {
    if (!file) {
      setStatus({ kind: 'error', message: 'Bitte zuerst eine Backup-Datei auswählen' });
      return;
    }

    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: data.error?.message || 'Wiederherstellung fehlgeschlagen',
        });
        return;
      }

      setStatus({ kind: 'success', message: data.message || 'Backup wurde wiederhergestellt' });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      router.refresh();
    } catch {
      setStatus({ kind: 'error', message: 'Verbindungsfehler beim Import' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-secondary/50 border border-white/5">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 text-[hsl(45,90%,70%)] flex-shrink-0 mt-0.5" />
          <p>
            Der Import <strong>ersetzt alle Daten</strong> (Konten, Transaktionen, Tanken, Arbeitszeit, Gewicht, …).
            Dein Login bleibt erhalten. Erstelle vorher ein Backup.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 justify-start gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary"
        >
          <Upload className="h-4 w-4" />
          {file ? file.name : 'Backup-Datei auswählen'}
        </Button>

        <Button
          type="button"
          onClick={handleImport}
          disabled={!file || loading}
          className="flex-1 glow"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Wiederherstellen
            </>
          )}
        </Button>
      </div>

      {status && (
        <div
          className={cn(
            'flex items-center gap-2 p-3 rounded-lg text-sm',
            status.kind === 'success'
              ? 'bg-[hsl(172,66%,65%)]/10 text-[hsl(172,66%,65%)] border border-[hsl(172,66%,65%)]/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          )}
        >
          {status.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          {status.message}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
