import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { goals } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { formatCurrency } from '@/lib/utils';
import { Plus, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { GoalList } from '@/components/goal-list';

export default async function GoalsPage() {
  const activeGoals = await db.query.goals.findMany({
    where: eq(goals.isActive, true),
    with: { linkedAccount: true, contributions: true },
  });

  const achievedGoals = activeGoals.filter(g => g.achievedAt);
  const inProgressGoals = activeGoals.filter(g => !g.achievedAt);

  // Calculate totals
  const totalTargetCents = inProgressGoals.reduce((sum, g) => sum + g.targetCents, 0);
  const totalCurrentCents = inProgressGoals.reduce((sum, g) => {
    return sum + g.contributions.reduce((cSum, c) => cSum + c.amountCents, 0);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gradient-text">Ziele</h1>
          <p className="text-muted-foreground mt-1">
            {inProgressGoals.length} aktive Ziele
            {achievedGoals.length > 0 && ` · ${achievedGoals.length} erreicht`}
          </p>
        </div>
        <Link href="/goals/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neues Ziel
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      {inProgressGoals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gesamtfortschritt</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(totalCurrentCents)} / {formatCurrency(totalTargetCents)}
                  </p>
                  <div className="mt-3">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-[hsl(172,66%,65%)] progress-animate rounded-full"
                        style={{ width: `${Math.min(100, (totalCurrentCents / totalTargetCents) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Erreichte Ziele</p>
                  <p className="text-2xl font-bold text-[hsl(172,66%,65%)] mt-1">
                    {achievedGoals.length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-[hsl(172,66%,65%)]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Aktive Ziele
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GoalList goals={inProgressGoals} />
        </CardContent>
      </Card>

      {/* Achieved Goals */}
      {achievedGoals.length > 0 && (
        <Card className="glass opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(172,66%,65%)]">
              <TrendingUp className="h-5 w-5" />
              Erreichte Ziele
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoalList goals={achievedGoals} isAchieved />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
