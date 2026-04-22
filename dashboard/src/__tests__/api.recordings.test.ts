/**
 * Integration tests — POST/GET/DELETE /api/recordings
 *
 * External dependencies (Supabase, Prisma, NextAuth) are mocked so the
 * route handler logic can be exercised without live infrastructure.
 */

import { NextResponse } from 'next/server';

// ── Mock next-auth ──────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));
jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}));
jest.mock('next-auth/next', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockRecordingCreate = jest.fn();
const mockRecordingFindMany = jest.fn();
const mockRecordingDeleteMany = jest.fn();
const mockPrisma = {
  recording: {
    create: mockRecordingCreate,
    findMany: mockRecordingFindMany,
    deleteMany: mockRecordingDeleteMany,
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// ── Mock Supabase ───────────────────────────────────────────────────────────
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockListBuckets = jest.fn();
const mockCreateBucket = jest.fn();
const mockStorageRemove = jest.fn();

const mockSupabase = {
  storage: {
    listBuckets: mockListBuckets,
    createBucket: mockCreateBucket,
    from: jest.fn(() => ({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
      remove: mockStorageRemove,
    })),
  },
};
jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  supabase: mockSupabase,
}));

// ── Mock auth options ───────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  __esModule: true,
  authOptions: {},
}));

// ── Patch getServerSession to use our mock everywhere ──────────────────────
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// Re-mock the server-only getServerSession
beforeAll(() => {
  jest.resetModules();
});

// Inline the mock for the specific import path used by the route
jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Import routes AFTER mocks ───────────────────────────────────────────────
import { POST, GET, DELETE } from '@/app/api/recordings/route';

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(body: BodyInit | null = null, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/recordings', {
    method: 'POST',
    body,
    headers,
  });
}

function makeGetRequest() {
  return new Request('http://localhost:3000/api/recordings', { method: 'GET' });
}

function makeDeleteRequest(body: object) {
  return new Request('http://localhost:3000/api/recordings', {
    method: 'DELETE',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/recordings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when no session is present', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const fd = new FormData();
    fd.append('file', new Blob(['audio'], { type: 'audio/webm' }), 'test.webm');
    const req = new Request('http://localhost:3000/api/recordings', {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/unauthorized/i);
  });

  test('returns 400 when file is missing from the request', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const fd = new FormData();
    fd.append('title', 'Test Recording');
    const req = new Request('http://localhost:3000/api/recordings', {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/invalid or missing file/i);
  });

  test('returns 200 with recording data on successful upload', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockListBuckets.mockResolvedValue({ data: [{ name: 'recordings' }] });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://supabase.co/storage/v1/object/public/recordings/user-1/test.webm' },
    });
    const fakeRecording = {
      id: 'rec-1',
      title: 'Test Recording',
      fileUrl: 'https://supabase.co/storage/v1/object/public/recordings/user-1/test.webm',
      duration: 10,
      fileSize: 100,
      mimeType: 'audio/webm',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRecordingCreate.mockResolvedValue(fakeRecording);

    const fd = new FormData();
    fd.append('file', new Blob(['audio'], { type: 'audio/webm' }), 'test.webm');
    fd.append('title', 'Test Recording');
    fd.append('duration', '10');
    const req = new Request('http://localhost:3000/api/recordings', {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recording.id).toBe('rec-1');
  });

  test('returns 500 when Supabase upload fails', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockListBuckets.mockResolvedValue({ data: [{ name: 'recordings' }] });
    mockUpload.mockResolvedValue({ error: { message: 'Bucket quota exceeded' } });

    const fd = new FormData();
    fd.append('file', new Blob(['audio'], { type: 'audio/webm' }), 'test.webm');
    const req = new Request('http://localhost:3000/api/recordings', {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/bucket quota exceeded/i);
  });

  test('auto-creates bucket when it does not exist yet', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockListBuckets.mockResolvedValue({ data: [] });           // bucket absent
    mockCreateBucket.mockResolvedValue({ error: null });       // auto-create succeeds
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://supabase.co/storage/v1/object/public/recordings/user-1/x.webm' },
    });
    mockRecordingCreate.mockResolvedValue({ id: 'rec-2', title: 'Auto-bucket test', userId: 'user-1' });

    const fd = new FormData();
    fd.append('file', new Blob(['audio'], { type: 'audio/webm' }), 'x.webm');
    const req = new Request('http://localhost:3000/api/recordings', {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockCreateBucket).toHaveBeenCalledWith('recordings', expect.objectContaining({ public: true }));
  });
});

describe('GET /api/recordings', () => {
  const supabaseBase = 'https://my-project.supabase.co';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseBase;
  });

  test('returns 401 when no session is present', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('returns recordings list with pagination total', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const recordings = [
      { id: 'r1', fileUrl: `${supabaseBase}/storage/v1/object/public/recordings/user-1/a.webm`, userId: 'user-1', title: 'A', duration: 5, fileSize: 50, mimeType: 'audio/webm', createdAt: new Date(), updatedAt: new Date() },
      { id: 'r2', fileUrl: `${supabaseBase}/storage/v1/object/public/recordings/user-1/b.webm`, userId: 'user-1', title: 'B', duration: 10, fileSize: 100, mimeType: 'audio/webm', createdAt: new Date(), updatedAt: new Date() },
    ];
    mockRecordingFindMany.mockResolvedValue(recordings);
    mockRecordingDeleteMany.mockResolvedValue({});

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recordings).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
  });

  test('cleans orphaned DB entries that lack valid Supabase URLs', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const validRec = { id: 'r1', fileUrl: `${supabaseBase}/storage/v1/object/public/recordings/user-1/a.webm`, userId: 'user-1', title: 'A', duration: 5, fileSize: 50, mimeType: 'audio/webm', createdAt: new Date(), updatedAt: new Date() };
    const orphanRec = { id: 'orphan-1', fileUrl: 'http://old-server/file.webm', userId: 'user-1', title: 'Old', duration: 0, fileSize: 0, mimeType: 'audio/webm', createdAt: new Date(), updatedAt: new Date() };
    mockRecordingFindMany.mockResolvedValue([validRec, orphanRec]);
    mockRecordingDeleteMany.mockResolvedValue({});

    const res = await GET();
    const json = await res.json();
    expect(json.recordings).toHaveLength(1);
    expect(json.recordings[0].id).toBe('r1');
    expect(mockRecordingDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['orphan-1'] } },
    });
  });

  test('returns empty recordings array when user has no recordings', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-new' } });
    mockRecordingFindMany.mockResolvedValue([]);
    mockRecordingDeleteMany.mockResolvedValue({});

    const res = await GET();
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recordings).toHaveLength(0);
    expect(json.pagination.total).toBe(0);
  });
});

describe('DELETE /api/recordings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when no session is present', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeDeleteRequest({ id: 'rec-1' });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  test('returns 400 when id is missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const req = makeDeleteRequest({});
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing recording id/i);
  });

  test('returns 404 when recording does not exist or belongs to another user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const mockFindFirst = jest.fn().mockResolvedValue(null);
    mockPrisma.recording = { ...mockPrisma.recording, findFirst: mockFindFirst } as never;

    const req = makeDeleteRequest({ id: 'non-existent' });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/recording not found/i);
  });
});
