/**
 * Integration tests — GET /api/download-extension
 *
 * Tests the extension-zip-download endpoint with real in-process calls,
 * mocking fs/archiver so no actual filesystem access is needed.
 */

import path from 'path';

// ── Mock fs ─────────────────────────────────────────────────────────────────
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));
import fs from 'fs';
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

// ── Mock archiver ────────────────────────────────────────────────────────────
const mockArchiveDirectory = jest.fn();
const mockArchiveFinalize = jest.fn();
let capturedDataHandler: ((chunk: Uint8Array) => void) | null = null;
let capturedEndHandler: (() => void) | null = null;
type ArchiverHandler =
  | ((chunk: Uint8Array) => void)
  | (() => void)
  | ((err: Error) => void);

jest.mock('archiver', () => {
  return jest.fn(() => ({
    on: jest.fn((event: string, cb: ArchiverHandler) => {
      if (event === 'data') capturedDataHandler = cb as (chunk: Uint8Array) => void;
      if (event === 'end') capturedEndHandler = cb as () => void;
    }),
    directory: mockArchiveDirectory,
    finalize: mockArchiveFinalize.mockImplementation(() => {
      // Simulate writing one small chunk and then finishing
      if (capturedDataHandler) capturedDataHandler(Buffer.from('PK\x03\x04') as Uint8Array);
      if (capturedEndHandler) capturedEndHandler();
    }),
  }));
});

import { GET } from '@/app/api/download-extension/route';

describe('GET /api/download-extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedDataHandler = null;
    capturedEndHandler = null;
  });

  test('returns 404 when extension folder does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/extension folder not found/i);
  });

  test('returns a zip file with correct content-type when extension folder exists', async () => {
    mockExistsSync.mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toMatch(/meet-recorder-extension\.zip/);
  });

  test('archives from the correct extension directory path', async () => {
    mockExistsSync.mockReturnValue(true);

    await GET();

    const expectedDir = path.resolve(process.cwd(), '..', 'extension');
    expect(mockArchiveDirectory).toHaveBeenCalledWith(expectedDir, false);
  });

  test('resolves extension dir relative to the dashboard cwd', async () => {
    mockExistsSync.mockReturnValue(true);

    await GET();

    const [checkedPath] = (mockExistsSync as jest.Mock).mock.calls[0];
    expect(checkedPath).toMatch(/extension$/);
    expect(path.isAbsolute(checkedPath)).toBe(true);
  });
});
