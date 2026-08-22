import { requireAuth } from '@/lib/auth';
import { Navigation, MobileNav } from '@/components/navigation';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { isOnboardingComplete } from '@/lib/mode';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  const onboardingComplete = await isOnboardingComplete();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <DashboardWrapper initialOnboardingComplete={onboardingComplete}>
        <main className="container mx-auto px-4 py-6 pb-20 md:pb-6">
          {children}
        </main>
      </DashboardWrapper>
      <MobileNav />
    </div>
  );
}
