/**
 * Integration tests — GET /api/debug/env
 *
 * Validates that the debug env route exposes the correct shape and masks
 * sensitive values without exposing them in plain text.
 */

import { GET } from '@/app/api/debug/env/route';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore environment after each test
  process.env = { ...ORIGINAL_ENV };
});

describe('GET /api/debug/env', () => {
  test('responds with ok: true and expected env keys', async () => {
    process.env.GOOGLE_CLIENT_ID = 'fake-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'fake-secret';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    process.env.NEXTAUTH_SECRET = 'my-random-secret-value';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.env).toBeDefined();
    expect(Object.keys(json.env)).toEqual(
      expect.arrayContaining([
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'NEXTAUTH_URL',
        'NEXTAUTH_SECRET',
        'DATABASE_URL',
      ])
    );
  });

  test('reports GOOGLE_CLIENT_ID as present and looksLikeAppsId when set', async () => {
    process.env.GOOGLE_CLIENT_ID = '123456.apps.googleusercontent.com';

    const res = await GET();
    const json = await res.json();

    expect(json.env.GOOGLE_CLIENT_ID.present).toBe(true);
    expect(json.env.GOOGLE_CLIENT_ID.looksLikeAppsId).toBe(true);
  });

  test('masks GOOGLE_CLIENT_ID value and does not expose it in plain text', async () => {
    process.env.GOOGLE_CLIENT_ID = '123456789.apps.googleusercontent.com';

    const res = await GET();
    const json = await res.json();

    expect(json.env.GOOGLE_CLIENT_ID.valueMasked).not.toBe(process.env.GOOGLE_CLIENT_ID);
    expect(json.env.GOOGLE_CLIENT_ID.valueMasked).toMatch(/…/);
  });

  test('masks NEXTAUTH_SECRET value', async () => {
    process.env.NEXTAUTH_SECRET = 'super-long-secret-value-that-should-be-masked';

    const res = await GET();
    const json = await res.json();

    expect(json.env.NEXTAUTH_SECRET.valueMasked).not.toBe(process.env.NEXTAUTH_SECRET);
    expect(json.env.NEXTAUTH_SECRET.valueMasked).toMatch(/…/);
  });

  test('reports looksPlaceholder true for NEXTAUTH_SECRET containing placeholder text', async () => {
    process.env.NEXTAUTH_SECRET = 'generate-a-random-secret-here';

    const res = await GET();
    const json = await res.json();

    expect(json.env.NEXTAUTH_SECRET.looksPlaceholder).toBe(true);
  });

  test('reports DATABASE_URL as not present when env var is unset', async () => {
    delete process.env.DATABASE_URL;

    const res = await GET();
    const json = await res.json();

    expect(json.env.DATABASE_URL.present).toBe(false);
    expect(json.env.DATABASE_URL.valueMasked).toBeNull();
  });

  test('reports NEXTAUTH_URL value directly (not masked)', async () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';

    const res = await GET();
    const json = await res.json();

    expect(json.env.NEXTAUTH_URL.value).toBe('http://localhost:3000');
    expect(json.env.NEXTAUTH_URL.present).toBe(true);
  });

  test('reports looksPlaceholder true for DATABASE_URL with placeholder tokens', async () => {
    process.env.DATABASE_URL = 'postgresql://user:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:6543/postgres';

    const res = await GET();
    const json = await res.json();

    expect(json.env.DATABASE_URL.looksPlaceholder).toBe(true);
  });
});
