'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Wallet,
  History,
  Target,
  Settings,
  CreditCard,
  Bot,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Konten', icon: Wallet },
  { href: '/transactions', label: 'Transaktionen', icon: CreditCard },
  { href: '/history', label: 'Historie', icon: History },
  { href: '/goals', label: 'Ziele', icon: Target },
  { href: '/coach', label: 'Coach', icon: Bot },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 md:hidden safe-area-pb">
      <div className="flex justify-around py-2 px-2">
        {navItems.slice(0, 5).map((item) => {
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
      </div>
    </nav>
  );
}
