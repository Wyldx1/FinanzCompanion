'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Key } from 'lucide-react';

export default function PasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Ändern des Passworts');
        return;
      }

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        router.push('/settings');
      }, 2000);
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card className="glass gradient-border overflow-hidden">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>Passwort ändern</CardTitle>
          </div>
          <CardDescription>
            Wähle ein sicheres Passwort mit mindestens 8 Zeichen
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Aktuelles Passwort</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Neues Passwort</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Passwort bestätigen</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-[hsl(172,66%,65%)]/10 border border-[hsl(172,66%,65%)]/20">
                <p className="text-sm text-[hsl(172,66%,65%)]">
                  Passwort erfolgreich geändert! Du wirst weitergeleitet...
                </p>
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
              <Button type="submit" disabled={loading || success} className="flex-1 glow">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Speichern
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
