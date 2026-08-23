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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Repeat,
  HardHat,
  Fuel,
  Scale,
  ChevronDown,
  Wrench,
  MoreHorizontal,
} from 'lucide-react';

// =====================================================
// NAVIGATIONSDATEN
// =====================================================

const financeItems = [
  { href: '/accounts', label: 'Konten', icon: Wallet },
  { href: '/transactions', label: 'Transaktionen', icon: CreditCard },
  { href: '/recurring-expenses', label: 'Daueraufträge', icon: Repeat },
  { href: '/debts', label: 'Schulden', icon: TrendingDown },
  { href: '/goals', label: 'Ziele', icon: Target },
  { href: '/history', label: 'Historie', icon: History },
];

const toolItems = [
  { href: '/fuel', label: 'Tanken', icon: Fuel },
  { href: '/worktime', label: 'Arbeitszeit', icon: HardHat },
  { href: '/weight', label: 'Gewicht', icon: Scale },
];

const mainItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/coach', label: 'Coach', icon: Bot },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function isInGroup(pathname: string, items: { href: string }[]): boolean {
  return items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

// =====================================================
// DESKTOP-NAVIGATION
// =====================================================

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:inline">
              Finanz-Companion
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {/* Dashboard */}
            <NavLink href="/" label="Dashboard" icon={LayoutDashboard} pathname={pathname} />

            {/* Finanzen Dropdown */}
            <NavDropdown
              label="Finanzen"
              icon={Wallet}
              items={financeItems}
              pathname={pathname}
            />

            {/* Tools Dropdown */}
            <NavDropdown
              label="Tools"
              icon={Wrench}
              items={toolItems}
              pathname={pathname}
            />

            {/* Coach */}
            <NavLink href="/coach" label="Coach" icon={Bot} pathname={pathname} />

            {/* Einstellungen */}
            <NavLink href="/settings" label="Einstellungen" icon={Settings} pathname={pathname} />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 ml-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
}) {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary/20 text-primary glow'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
      {label}
    </Link>
  );
}

function NavDropdown({
  label,
  icon: Icon,
  items,
  pathname,
}: {
  label: string;
  icon: React.ElementType;
  items: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  const isActive = isInGroup(pathname, items);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 outline-none',
            isActive
              ? 'bg-primary/20 text-primary glow'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          )}
        >
          <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {items.map((item) => {
          const ItemIcon = item.icon;
          const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 py-2.5',
                  itemActive && 'bg-primary/10 text-primary'
                )}
              >
                <ItemIcon className={cn('h-4 w-4', itemActive && 'text-primary')} />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =====================================================
// MOBILE-NAVIGATION
// =====================================================

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<'finance' | 'tools' | 'more' | null>(null);

  async function handleLogout() {
    setOpenDialog(null);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const financeActive = isInGroup(pathname, financeItems);
  const toolsActive = isInGroup(pathname, toolItems);
  const moreActive = isInGroup(pathname, mainItems.slice(1));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 md:hidden safe-area-pb">
        <div className="flex justify-around py-2 px-1">
          <MobileNavLink href="/" label="Dashboard" icon={LayoutDashboard} pathname={pathname} />
          <MobileNavButton
            label="Finanzen"
            icon={Wallet}
            isActive={financeActive}
            onClick={() => setOpenDialog('finance')}
          />
          <MobileNavButton
            label="Tools"
            icon={Wrench}
            isActive={toolsActive}
            onClick={() => setOpenDialog('tools')}
          />
          <MobileNavLink href="/coach" label="Coach" icon={Bot} pathname={pathname} />
          <MobileNavButton
            label="Mehr"
            icon={MoreHorizontal}
            isActive={moreActive}
            onClick={() => setOpenDialog('more')}
          />
        </div>
      </nav>

      {/* Finanzen Dialog */}
      <MobileGroupDialog
        open={openDialog === 'finance'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        title="Finanzen"
        items={financeItems}
        pathname={pathname}
      />

      {/* Tools Dialog */}
      <MobileGroupDialog
        open={openDialog === 'tools'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        title="Tools"
        items={toolItems}
        pathname={pathname}
      />

      {/* Mehr Dialog */}
      <Dialog open={openDialog === 'more'} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="glass bottom-0 top-auto translate-y-0 rounded-b-none border-white/10 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-b-lg">
          <DialogHeader>
            <DialogTitle>Mehr</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <MobileDialogLink
              href="/settings"
              label="Einstellungen"
              icon={Settings}
              pathname={pathname}
              onClick={() => setOpenDialog(null)}
            />
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

function MobileNavLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
}) {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all duration-200 min-w-[56px]',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <div className={cn('p-2 rounded-lg transition-all duration-200', isActive && 'bg-primary/20 glow')}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

function MobileNavButton({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all duration-200 min-w-[56px]',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <div className={cn('p-2 rounded-lg transition-all duration-200', isActive && 'bg-primary/20 glow')}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}

function MobileGroupDialog({
  open,
  onOpenChange,
  title,
  items,
  pathname,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass bottom-0 top-auto translate-y-0 rounded-b-none border-white/10 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-b-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {items.map((item) => (
            <MobileDialogLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
              onClick={() => onOpenChange(false)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MobileDialogLink({
  href,
  label,
  icon: Icon,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
  onClick: () => void;
}) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
      {label}
    </Link>
  );
}
