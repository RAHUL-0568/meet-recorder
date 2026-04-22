import { NextResponse } from 'next/server';

function mask(value: string | undefined | null) {
  if (!value) return null;
  const v = value.trim();
  if (v.length <= 8) return `${v.slice(0, 2)}…${v.slice(-2)}`;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export async function GET() {
  const debugEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_DEBUG_ENV_ENDPOINT === 'true';

  if (!debugEnabled) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  const databaseUrl = process.env.DATABASE_URL;

  return NextResponse.json({
    ok: true,
    env: {
      GOOGLE_CLIENT_ID: {
        present: Boolean(googleClientId),
        valueMasked: mask(googleClientId),
        looksLikeAppsId: Boolean(googleClientId?.includes('.apps.googleusercontent.com')),
      },
      GOOGLE_CLIENT_SECRET: {
        present: Boolean(googleClientSecret),
        valueMasked: mask(googleClientSecret),
      },
      NEXTAUTH_URL: {
        present: Boolean(nextAuthUrl),
        value: nextAuthUrl || null,
      },
      NEXTAUTH_SECRET: {
        present: Boolean(nextAuthSecret),
        valueMasked: mask(nextAuthSecret),
        looksPlaceholder: Boolean(nextAuthSecret?.includes('generate-a-random-secret-here')),
      },
      DATABASE_URL: {
        present: Boolean(databaseUrl),
        valueMasked: mask(databaseUrl),
        looksPlaceholder: Boolean(databaseUrl?.includes('[YOUR-PASSWORD]') || databaseUrl?.includes('[YOUR-PROJECT-REF]')),
      },
    },
  });
}

