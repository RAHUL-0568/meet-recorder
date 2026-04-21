// ============================================================
// API: /api/recordings/[id]
// GET    — Get a single recording
// DELETE — Delete a recording and its Supabase bucket file
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------
// GET /api/recordings/:id
// -----------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    const recording = await prisma.recording.findFirst({
      where: { id, userId },
    });

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    return NextResponse.json({ recording });
  } catch (error) {
    console.error('GET /api/recordings/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// -----------------------------------------------------------
// DELETE /api/recordings/:id
// -----------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    const recording = await prisma.recording.findFirst({
      where: { id, userId },
    });

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // 🗑️ Delete file from Supabase bucket
    if (recording.fileUrl.includes('supabase.co')) {
      const parts = recording.fileUrl.split('/object/public/recordings/');
      if (parts[1]) {
        const storagePath = decodeURIComponent(parts[1]);
        const { error: deleteError } = await supabase.storage
          .from('recordings')
          .remove([storagePath]);

        if (deleteError) {
          console.warn('⚠️ Bucket file delete failed:', deleteError.message);
        }
      }
    }

    // 🗑️ Delete database record
    await prisma.recording.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/recordings/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
