// ============================================================
// Recordings API — Upload audio to Supabase bucket + save to DB
// ============================================================

import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ─── POST — Upload audio file to Supabase Storage bucket ───
export async function POST(req: Request) {
  try {
    // 🔐 AUTH
    const session = await getServerSession(authOptions);

    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();

    const file = formData.get("file");
    const title = formData.get("title") || "Google Meet Recording";
    const duration = Number(formData.get("duration") || 0);

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing file" },
        { status: 400 }
      );
    }

    // 📁 Generate unique filename
    const fileExt = (file as File).name?.split(".").pop() || "webm";
    const fileName = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const buffer = await file.arrayBuffer();

    // ☁️ Ensure "recordings" bucket exists (auto-create on first use)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === "recordings");
    if (!bucketExists) {
      const { error: createErr } = await supabase.storage.createBucket("recordings", {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ["audio/*", "video/*"],
      });
      if (createErr) {
        console.error("❌ Bucket creation error:", createErr);
        return NextResponse.json(
          { success: false, error: "Could not create storage bucket: " + createErr.message },
          { status: 500 }
        );
      }
      console.log("✅ Created 'recordings' bucket");
    }

    // ☁️ Upload to Supabase Storage bucket "recordings"
    const { error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(fileName, buffer, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // 🔗 Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("recordings")
      .getPublicUrl(fileName);

    const fileUrl = urlData.publicUrl;

    // 💾 Save recording metadata to Postgres via Prisma
    const recording = await prisma.recording.create({
      data: {
        title: String(title),
        fileUrl,
        duration,
        fileSize: file.size,
        mimeType: file.type || "audio/webm",
        userId,
      },
    });

    console.log("✅ Audio stored in bucket & saved to DB:", fileUrl);

    return NextResponse.json({
      success: true,
      recording,
    });
  } catch (err: unknown) {
    console.error("❌ Server error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

// ─── GET — List recordings for authenticated user ───
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const allRecordings = await prisma.recording.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Only return recordings stored in Supabase bucket
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const validRecordings = allRecordings.filter((r) =>
      r.fileUrl.includes(supabaseUrl) && r.fileUrl.includes("/storage/")
    );

    // Auto-clean orphaned DB entries (no valid bucket file)
    const orphanIds = allRecordings
      .filter((r) => !r.fileUrl.includes(supabaseUrl) || !r.fileUrl.includes("/storage/"))
      .map((r) => r.id);

    if (orphanIds.length > 0) {
      await prisma.recording.deleteMany({ where: { id: { in: orphanIds } } });
      console.log(`🧹 Cleaned ${orphanIds.length} orphaned recording(s)`);
    }

    return NextResponse.json({
      success: true,
      recordings: validRecordings,
      pagination: { total: validRecordings.length },
    });
  } catch (err: unknown) {
    console.error("❌ GET error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

// ─── DELETE — Remove recording from bucket + DB ───
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing recording ID" },
        { status: 400 }
      );
    }

    // Find the recording (ensure it belongs to the user)
    const recording = await prisma.recording.findFirst({
      where: { id, userId },
    });

    if (!recording) {
      return NextResponse.json(
        { success: false, error: "Recording not found" },
        { status: 404 }
      );
    }

    // 🗑️ Remove file from Supabase bucket
    // Extract the storage path from the public URL
    const url = new URL(recording.fileUrl);
    const storagePath = url.pathname.split("/object/public/recordings/")[1];

    if (storagePath) {
      const { error: deleteError } = await supabase.storage
        .from("recordings")
        .remove([decodeURIComponent(storagePath)]);

      if (deleteError) {
        console.error("⚠️ Bucket delete error:", deleteError.message);
        // Continue to delete DB record even if bucket delete fails
      }
    }

    // 🗑️ Remove from database
    await prisma.recording.delete({ where: { id } });

    console.log("✅ Recording deleted:", id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Delete error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}
