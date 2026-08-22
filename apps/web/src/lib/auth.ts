import { cookies } from 'next/headers';
import { db } from './db';
import { sessions, users } from '@finanz/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { verify, hash } from '@node-rs/argon2';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Clean up expired sessions
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    // Secure nur bei HTTPS (z. B. IP-only-Deployment laeuft über HTTP)
    secure: process.env.APP_URL?.startsWith('https://') ?? false,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return sessionId;
}

export async function validateSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return session || null;
}

export async function requireAuth() {
  const session = await validateSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

// For API routes: returns the session or a JSON 401 response
export async function requireAuthApi() {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Nicht authentifiziert' } },
      { status: 401 }
    );
  }
  return session;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

export async function verifyPassword(passphrase: string): Promise<number | null> {
  const [user] = await db.select().from(users).limit(1);

  if (!user) {
    return null;
  }

  const isValid = await verify(user.passphraseHash, passphrase);
  return isValid ? user.id : null;
}

export async function hashPassword(passphrase: string): Promise<string> {
  return hash(passphrase, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}
