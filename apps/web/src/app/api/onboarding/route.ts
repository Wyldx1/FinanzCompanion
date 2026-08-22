import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { setOnboardingComplete } from '@/lib/mode';

export async function POST() {
  await requireAuth();

  try {
    await setOnboardingComplete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
