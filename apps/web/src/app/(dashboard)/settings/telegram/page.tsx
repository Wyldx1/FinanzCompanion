'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function TelegramPage() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function generateCode() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/telegram-code', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Generieren des Codes');
        return;
      }

      const data = await res.json();
      setCode(data.code);
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Back button */}
      <Link href="/settings">
        <Button variant="ghost" className="hover:bg-primary/10">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Einstellungen
        </Button>
      </Link>

      <Card className="glass gradient-border overflow-hidden">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bot className="h-5 w-5 text-[hsl(210,80%,70%)]" />
            <CardTitle>Telegram verknüpfen</CardTitle>
          </div>
          <CardDescription>
            Verbinde deinen Telegram-Account mit dem Finanz-Companion Bot
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Instructions */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">Code generieren</p>
                <p className="text-sm text-muted-foreground">
                  Klicke auf den Button unten, um einen einmaligen Verknüpfungscode zu erhalten.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">Bot öffnen</p>
                <p className="text-sm text-muted-foreground">
                  Öffne den Telegram-Bot und sende den Befehl <code className="bg-secondary px-1 rounded">/link</code>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">Code eingeben</p>
                <p className="text-sm text-muted-foreground">
                  Gib den generierten Code im Bot ein, um die Verknüpfung abzuschließen.
                </p>
              </div>
            </div>
          </div>

          {/* Code display */}
          {code && (
            <div className="p-6 rounded-xl bg-gradient-to-r from-primary/10 to-[hsl(210,80%,70%)]/10 text-center">
              <p className="text-sm text-muted-foreground mb-2">Dein Verknüpfungscode:</p>
              <div className="flex items-center justify-center gap-4">
                <code className="text-3xl font-mono font-bold tracking-widest">{code}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyCode}
                  className="hover:bg-primary/20"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-[hsl(172,66%,65%)]" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Der Code ist 10 Minuten gültig
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <Button
            onClick={generateCode}
            disabled={loading}
            className="w-full glow"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : code ? (
              <RefreshCw className="h-4 w-4 mr-2" />
            ) : (
              <Bot className="h-4 w-4 mr-2" />
            )}
            {code ? 'Neuen Code generieren' : 'Code generieren'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
