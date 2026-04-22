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
  readFileSync: jest.fn(),
}));
import fs from 'fs';
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

// ── Mock archiver ────────────────────────────────────────────────────────────
const mockArchiveDirectory = jest.fn();
const mockArchiveFinalize = jest.fn();
let capturedDataHandler: ((chunk: Uint8Array) => void) | null = null;
let capturedEndHandler: (() => void) | null = null;

jest.mock('archiver', () => {
  return jest.fn(() => ({
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
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

  test('returns 404 when prebuilt zip and extension folder are both missing', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/extension not found/i);
  });

  test('serves prebuilt zip from public when available', async () => {
    const prebuiltZip = path.resolve(process.cwd(), 'public', 'meet-recorder-extension.zip');
    const zipBuf = Buffer.from('PK\x03\x04');
    mockExistsSync.mockImplementation((p) => p === prebuiltZip);
    mockReadFileSync.mockReturnValue(zipBuf as never);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toMatch(/meet-recorder-extension\.zip/);
    expect(mockReadFileSync).toHaveBeenCalledWith(prebuiltZip);
  });

  test('archives from the correct extension directory path when prebuilt zip is missing', async () => {
    const prebuiltZip = path.resolve(process.cwd(), 'public', 'meet-recorder-extension.zip');
    const extensionDir = path.resolve(process.cwd(), '..', 'extension');
    mockExistsSync.mockImplementation((p) => p === extensionDir && p !== prebuiltZip);

    await GET();

    expect(mockArchiveDirectory).toHaveBeenCalledWith(extensionDir, false);
  });

  test('checks paths in expected order for prebuilt zip then extension dir', async () => {
    const prebuiltZip = path.resolve(process.cwd(), 'public', 'meet-recorder-extension.zip');
    const extensionDir = path.resolve(process.cwd(), '..', 'extension');
    mockExistsSync.mockImplementation((p) => p === extensionDir && p !== prebuiltZip);

    await GET();

    expect(mockExistsSync).toHaveBeenNthCalledWith(1, prebuiltZip);
    expect(mockExistsSync).toHaveBeenNthCalledWith(2, extensionDir);
  });
});
