'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Login fehlgeschlagen');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass gradient-border slide-in" style={{ animationDelay: '0.2s' }}>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Anmelden
        </CardTitle>
        <CardDescription>
          Gib deine Passphrase ein, um fortzufahren
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              autoFocus
              className="h-12 bg-secondary/50 border-white/10 focus:border-primary/50 transition-colors"
            />
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <Button
            type="submit"
            className="w-full h-12 glow hover-lift group"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Anmelden
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
