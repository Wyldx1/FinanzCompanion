import { requireAuth } from '@/lib/auth';
import { Navigation, MobileNav } from '@/components/navigation';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { isOnboardingComplete, getEnabledModules } from '@/lib/mode';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  const [onboardingComplete, enabledModules] = await Promise.all([
    isOnboardingComplete(),
    getEnabledModules(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation enabledModules={enabledModules} />
      <DashboardWrapper initialOnboardingComplete={onboardingComplete}>
        <main className="container mx-auto px-4 py-6 pb-20 md:pb-6">
          {children}
        </main>
      </DashboardWrapper>
      <MobileNav enabledModules={enabledModules} />
    </div>
  );
}
