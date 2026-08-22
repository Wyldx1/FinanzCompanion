import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi, SESSION_COOKIE_NAME } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, sessions } from '@finanz/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { verify, hash } from '@node-rs/argon2';
import { z } from 'zod';
import { cookies } from 'next/headers';

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = passwordSchema.parse(body);

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Benutzer nicht gefunden' } },
        { status: 404 }
      );
    }

    // Verify current password
    const valid = await verify(user.passphraseHash, currentPassword);
    if (!valid) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'Aktuelles Passwort ist falsch' } },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await hash(newPassword);

    // Update password
    await db
      .update(users)
      .set({ passphraseHash: newPasswordHash })
      .where(eq(users.id, session.userId));

    // Invalidate all other sessions
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (currentSessionId) {
      await db
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, session.userId),
            ne(sessions.id, currentSessionId)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Daten' } },
        { status: 400 }
      );
    }

    console.error('Password change error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
