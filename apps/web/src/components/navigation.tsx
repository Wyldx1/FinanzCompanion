'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Wallet,
  History,
  Target,
  Settings,
  CreditCard,
  TrendingDown,
  Bot,
  Sparkles,
  Menu,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Konten', icon: Wallet },
  { href: '/transactions', label: 'Transaktionen', icon: CreditCard },
  { href: '/debts', label: 'Schulden', icon: TrendingDown },
  { href: '/history', label: 'Historie', icon: History },
  { href: '/goals', label: 'Ziele', icon: Target },
  { href: '/coach', label: 'Coach', icon: Bot },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

// Mobile: 4 feste Slots + „Mehr"-Dialog für den Rest
const mobileNavItems = [navItems[0], navItems[1], navItems[2], navItems[5]];
const moreNavItems = [navItems[3], navItems[4], navItems[6]];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:inline">
              Finanz-Companion
            </span>
          </Link>
          <div className="hidden md:flex md:items-center md:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/20 text-primary glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreNavItems.some((item) => item.href === pathname);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 md:hidden safe-area-pb">
        <div className="flex justify-around py-2 px-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'p-2 rounded-lg transition-all duration-200',
                  isActive && 'bg-primary/20 glow'
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px]',
              moreActive
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <div className={cn(
              'p-2 rounded-lg transition-all duration-200',
              moreActive && 'bg-primary/20 glow'
            )}>
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium">Mehr</span>
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="glass bottom-0 top-auto translate-y-0 rounded-b-none border-white/10 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-b-lg">
          <DialogHeader>
            <DialogTitle>Mehr</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {moreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive transition-all duration-200 hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              Abmelden
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
