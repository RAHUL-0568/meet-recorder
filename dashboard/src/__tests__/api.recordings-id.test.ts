/**
 * Integration tests — GET /api/recordings/[id]  &  DELETE /api/recordings/[id]
 *
 * External dependencies (Supabase, Prisma, NextAuth) are mocked so the
 * route handler logic can be exercised without live infrastructure.
 */

// ── Mock next-auth ──────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));
jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockFindFirst = jest.fn();
const mockDelete = jest.fn();
const mockPrisma = {
  recording: {
    findFirst: mockFindFirst,
    delete: mockDelete,
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// ── Mock Supabase ───────────────────────────────────────────────────────────
const mockStorageRemove = jest.fn();
jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  supabase: {
    storage: {
      from: jest.fn(() => ({ remove: mockStorageRemove })),
    },
  },
}));

// ── Mock auth options ───────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  __esModule: true,
  authOptions: {},
}));

import { GET, DELETE } from '@/app/api/recordings/[id]/route';

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeGetReq() {
  return new Request('http://localhost:3000/api/recordings/rec-1', { method: 'GET' });
}

function makeDeleteReq() {
  return new Request('http://localhost:3000/api/recordings/rec-1', { method: 'DELETE' });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/recordings/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 when no session is present', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(makeGetReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  test('returns 200 with recording data when found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const fakeRec = {
      id: 'rec-1',
      title: 'Test Meeting',
      fileUrl: 'https://project.supabase.co/storage/v1/object/public/recordings/user-1/rec-1.webm',
      duration: 120,
      fileSize: 2048,
      mimeType: 'audio/webm',
      meetingCode: 'abc-def-ghi',
      transcript: null,
      summary: null,
      keyPoints: [],
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockFindFirst.mockResolvedValue(fakeRec);

    const res = await GET(makeGetReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recording.id).toBe('rec-1');
    expect(json.recording.title).toBe('Test Meeting');
    expect(json.recording.meetingCode).toBe('abc-def-ghi');
  });

  test('returns 404 when recording is not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue(null);

    const res = await GET(makeGetReq(), { params: Promise.resolve({ id: 'missing-rec' }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/recording not found/i);
  });

  test('returns 404 when recording belongs to a different user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-2' } });
    // Prisma returns null because userId filter does not match
    mockFindFirst.mockResolvedValue(null);

    const res = await GET(makeGetReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(404);
  });

  test('passes correct userId to Prisma query', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-42' } });
    mockFindFirst.mockResolvedValue({ id: 'rec-1', title: 'X', userId: 'user-42' });

    await GET(makeGetReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'rec-1', userId: 'user-42' },
    });
  });
});

describe('DELETE /api/recordings/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 when no session is present', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await DELETE(makeDeleteReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(401);
  });

  test('returns 404 when recording is not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue(null);

    const res = await DELETE(makeDeleteReq(), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/recording not found/i);
  });

  test('deletes DB record and returns success', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const fakeRec = {
      id: 'rec-1',
      fileUrl: 'https://project.supabase.co/storage/v1/object/public/recordings/user-1/rec-1.webm',
      userId: 'user-1',
    };
    mockFindFirst.mockResolvedValue(fakeRec);
    mockStorageRemove.mockResolvedValue({ error: null });
    mockDelete.mockResolvedValue({});

    const res = await DELETE(makeDeleteReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'rec-1' } });
  });

  test('still deletes DB record even when Supabase bucket delete fails', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue({
      id: 'rec-1',
      fileUrl: 'https://project.supabase.co/storage/v1/object/public/recordings/user-1/rec-1.webm',
      userId: 'user-1',
    });
    mockStorageRemove.mockResolvedValue({ error: { message: 'Object not found' } });
    mockDelete.mockResolvedValue({});

    const res = await DELETE(makeDeleteReq(), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // DB delete must still be called
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'rec-1' } });
  });

  test('does not attempt Supabase delete for non-Supabase URLs', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue({
      id: 'rec-old',
      fileUrl: 'http://old-server.example.com/file.webm',
      userId: 'user-1',
    });
    mockDelete.mockResolvedValue({});

    const res = await DELETE(makeDeleteReq(), { params: Promise.resolve({ id: 'rec-old' }) });
    expect(res.status).toBe(200);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });
});
