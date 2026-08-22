import { LoginForm } from '@/components/login-form';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export default async function LoginPage() {
  const session = await validateSession();

  if (session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--pastel-pink))]/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8 slide-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 glow">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Finanz-Companion</h1>
          <p className="text-muted-foreground mt-2">
            Monatlicher Vermögens-Snapshot mit Coaching
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
