// ============================================================
// GET /api/download-extension — Zip & serve the extension folder
// ============================================================

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

export async function GET() {
  // The extension folder sits one level above the dashboard
  const extensionDir = path.resolve(process.cwd(), '..', 'extension');

  if (!fs.existsSync(extensionDir)) {
    return NextResponse.json(
      { error: 'Extension folder not found' },
      { status: 404 },
    );
  }

  // Create the zip in memory via a stream
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

    // Add the whole extension folder into the zip root
    archive.directory(extensionDir, false);
    archive.finalize();
  });
}
