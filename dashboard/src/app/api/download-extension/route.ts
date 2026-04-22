// ============================================================
// GET /api/download-extension — Serve the extension zip
// ============================================================
// In production (Vercel), the extension folder doesn't exist on
// the server. We serve a pre-built zip from public/ instead.
// In local dev, we fall back to zipping the extension folder
// on-the-fly if the pre-built zip doesn't exist.
// ============================================================

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  // 1️⃣ Try to serve the pre-built zip from public/
  const prebuiltZip = path.resolve(process.cwd(), 'public', 'meet-recorder-extension.zip');

  if (fs.existsSync(prebuiltZip)) {
    const buf = fs.readFileSync(prebuiltZip);
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="meet-recorder-extension.zip"',
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 2️⃣ Fallback: zip the extension folder on-the-fly (local dev only)
  const extensionDir = path.resolve(process.cwd(), '..', 'extension');

  if (!fs.existsSync(extensionDir)) {
    return NextResponse.json(
      {
        error: 'Extension not found. In production, place meet-recorder-extension.zip in public/. ' +
               'Run: npm run bundle-extension',
      },
      { status: 404 },
    );
  }

  // Dynamic import — archiver is only needed in dev fallback
  const archiver = (await import('archiver')).default;
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Uint8Array[] = [];

  return new Promise<Response>((resolve, reject) => {
    archive.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    archive.on('end', () => {
      const buf = Buffer.concat(chunks);
      resolve(
        new Response(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="meet-recorder-extension.zip"',
            'Content-Length': String(buf.length),
          },
        }),
      );
    });
    archive.on('error', (err: Error) => {
      reject(
        NextResponse.json({ error: err.message }, { status: 500 }),
      );
    });

    archive.directory(extensionDir, false);
    archive.finalize();
  });
}
