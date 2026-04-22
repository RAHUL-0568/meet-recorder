// ============================================================
// Recordings List Page — shows all user recordings
// ============================================================

"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import RecordingCard from "@/components/RecordingCard";
import { useRouter } from "next/navigation";

interface Recording {
  id: string;
  title: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  meetingCode: string | null;
}

export default function RecordingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchRecordings = async () => {
    try {
      const res = await fetch("/api/recordings");
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error("Failed to fetch recordings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRecordings();
    }
  }, [router, status]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => prev - 1);
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      console.error("Failed to delete recording:", error);
      throw error;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>My Recordings</h1>
          </div>
        </div>
        <div className="recordings-grid">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rec-card"
              style={{ opacity: 0.5, animation: "shimmer 1.5s infinite" }}
            >
              <div className="rec-card-link">
                <div className="rec-card-visual" />
                <div className="rec-card-info">
                  <div
                    style={{
                      width: "60%",
                      height: 16,
                      background: "var(--bg-elevated)",
                      borderRadius: 4,
                    }}
                  />
                  <div
                    style={{
                      width: "40%",
                      height: 12,
                      background: "var(--bg-elevated)",
                      borderRadius: 4,
                      marginTop: 8,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>My Recordings</h1>
          <p className="page-header-meta">
            {total} recording{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {recordings.length > 0 ? (
        <div className="recordings-grid">
          {recordings.map((rec) => (
            <RecordingCard
              key={rec.id}
              id={rec.id}
              title={rec.title}
              duration={rec.duration}
              fileSize={rec.fileSize}
              createdAt={rec.createdAt}
              meetingCode={rec.meetingCode}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="empty-page-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ color: "var(--text-muted)" }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l2 2" />
          </svg>
          <h2>No recordings yet</h2>
          <p>
            Start recording your Google Meet sessions using the Chrome
            extension.
          </p>
        </div>
      )}
    </div>
  );
}
