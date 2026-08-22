'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil, Archive, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Goal {
  id: number;
  name: string;
  kind: string;
  targetCents: number;
  targetDate: Date | null;
  monthlyPlanCents: number | null;
  achievedAt: Date | null;
  contributions: { amountCents: number }[];
  linkedAccount: { id: number; name: string; icon: string | null } | null;
}

interface GoalKindConfig {
  [key: string]: {
    label: string;
    icon: LucideIcon;
    color: string;
    bg: string;
  };
}

interface GoalListProps {
  goals: Goal[];
  goalKindConfig: GoalKindConfig;
  isAchieved?: boolean;
}

export function GoalList({ goals, goalKindConfig, isAchieved = false }: GoalListProps) {
  const router = useRouter();

  async function handleArchive(id: number) {
    if (!confirm('Ziel wirklich archivieren?')) return;

    await fetch(`/api/goals/${id}`, {
      method: 'DELETE',
    });

    router.refresh();
  }

  async function handleMarkAchieved(id: number) {
    await fetch(`/api/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievedAt: new Date().toISOString() }),
    });

    router.refresh();
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🎯</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine aktiven Ziele</p>
        <p className="text-muted-foreground text-sm">
          Setze dir ein neues finanzielles Ziel
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal, index) => {
        const config = goalKindConfig[goal.kind] || goalKindConfig.custom;
        const Icon = config.icon;

        const currentCents = goal.contributions.reduce(
          (sum, c) => sum + c.amountCents,
          0
        );
        const progress = Math.min(1, currentCents / goal.targetCents);
        const remainingCents = goal.targetCents - currentCents;

        // Calculate months to goal if monthly plan is set
        let monthsToGoal: number | null = null;
        if (goal.monthlyPlanCents && remainingCents > 0) {
          monthsToGoal = Math.ceil(remainingCents / goal.monthlyPlanCents);
        }

        return (
          <div
            key={goal.id}
            className={cn(
              'p-5 rounded-xl transition-all duration-300 slide-in',
              isAchieved ? 'bg-[hsl(172,66%,65%)]/5' : 'bg-secondary/50 hover:bg-secondary/80'
            )}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.bg)}>
                  <Icon className={cn('h-6 w-6', config.color)} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{goal.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', config.bg, config.color)}>
                      {config.label}
                    </span>
                    {goal.linkedAccount && (
                      <span className="text-xs text-muted-foreground">
                        {goal.linkedAccount.icon} {goal.linkedAccount.name}
                      </span>
                    )}
                    {goal.targetDate && (
                      <span className="text-xs text-muted-foreground">
                        · Ziel: {new Date(goal.targetDate).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isAchieved && (
                <div className="flex items-center gap-1">
                  {progress >= 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMarkAchieved(goal.id)}
                      className="hover:bg-[hsl(172,66%,65%)]/20 hover:text-[hsl(172,66%,65%)]"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/goals/${goal.id}/edit`)}
                    className="hover:bg-primary/20 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleArchive(goal.id)}
                    className="hover:bg-destructive/20 hover:text-destructive"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Progress Section */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{formatCurrency(currentCents)}</span>
                <span className="text-muted-foreground">{formatCurrency(goal.targetCents)}</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isAchieved
                      ? 'bg-[hsl(172,66%,65%)]'
                      : 'bg-gradient-to-r from-primary to-[hsl(172,66%,65%)] progress-animate'
                  )}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress * 100)}% erreicht</span>
                <span>
                  {remainingCents > 0 ? (
                    <>
                      Noch {formatCurrency(remainingCents)}
                      {monthsToGoal && ` · ~${monthsToGoal} Monate`}
                    </>
                  ) : (
                    <span className="text-[hsl(172,66%,65%)]">Ziel erreicht!</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
