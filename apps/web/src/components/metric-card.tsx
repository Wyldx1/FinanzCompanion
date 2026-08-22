'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Clock,
  Target,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Clock,
  Target,
  Sparkles,
};

interface MetricCardProps {
  title: string;
  value: string;
  icon: keyof typeof icons;
  subtitle?: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'purple' | 'mint' | 'pink' | 'blue' | 'yellow' | 'orange';
}

const colorClasses = {
  purple: {
    bg: 'bg-[hsl(262,83%,75%)]/10',
    text: 'text-[hsl(262,83%,75%)]',
    glow: 'shadow-[0_0_20px_-5px_hsl(262,83%,75%,0.3)]',
  },
  mint: {
    bg: 'bg-[hsl(172,66%,65%)]/10',
    text: 'text-[hsl(172,66%,65%)]',
    glow: 'shadow-[0_0_20px_-5px_hsl(172,66%,65%,0.3)]',
  },
  pink: {
    bg: 'bg-[hsl(330,80%,75%)]/10',
    text: 'text-[hsl(330,80%,75%)]',
    glow: 'shadow-[0_0_20px_-5px_hsl(330,80%,75%,0.3)]',
  },
  blue: {
    bg: 'bg-[hsl(210,80%,70%)]/10',
    text: 'text-[hsl(210,80%,70%)]',
    glow: 'shadow-[0_0_20px_-5px_hsl(210,80%,70%,0.3)]',
  },
  yellow: {
    bg: 'bg-[hsl(45,90%,70%)]/10',
    text: 'text-[hsl(45,90%,70%)]',
    glow: 'shadow-[0_0_20px_-5px_hsl(45,90%,70%,0.3)]',
  },
  orange: {
    bg: 'bg-[hsl(25,90%,70%)]/10',
    text: 'text-[hsl(25,90%,70%)]',
    glow: 'shadow-[0_0_20px_-5px_hsl(25,90%,70%,0.3)]',
  },
};

export function MetricCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = 'purple',
}: MetricCardProps) {
  const colors = colorClasses[color];
  const trendColor = trend === 'up' ? 'mint' : trend === 'down' ? 'pink' : color;
  const trendColors = colorClasses[trendColor];
  const Icon = icons[icon];

  return (
    <Card className={cn(
      'glass hover-lift overflow-hidden relative group',
      colors.glow
    )}>
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
        colors.bg
      )} />

      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold count-up">{value}</p>
            {subtitle && (
              <p className={cn(
                'text-xs',
                trend ? trendColors.text : 'text-muted-foreground'
              )}>
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-xl transition-transform duration-300 group-hover:scale-110',
            colors.bg
          )}>
            <Icon className={cn('h-5 w-5', colors.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
