// ============================================================
// Single Recording Playback Page
// ============================================================

'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AudioPlayer from '@/components/AudioPlayer';

interface Recording {
  id: string;
  title: string;
  duration: number;
  fileSize: number;
  fileUrl: string;
  mimeType: string;
  meetingCode: string | null;
  transcript: string | null;
  summary: string | null;
  keyPoints: string[];
  createdAt: string;
}

export default function RecordingPlaybackPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = params?.id as string;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (status === 'authenticated' && id) {
      fetchRecording();
    }
  }, [status, id]);

  const fetchRecording = async () => {
    try {
      const res = await fetch(`/api/recordings/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRecording(data.recording);
      } else {
        setError('Recording not found');
      }
    } catch (err) {
      setError('Failed to load recording');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="playback-container">
        <div style={{ animation: 'shimmer 1.5s infinite' }}>
          <div style={{ width: 100, height: 14, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 24 }} />
          <div style={{ width: '60%', height: 28, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 40 }} />
          <div style={{ width: '100%', height: 200, background: 'var(--bg-card)', borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="playback-container">
        <div className="empty-page-state">
          <h2>{error || 'Recording not found'}</h2>
          <p>This recording may have been deleted.</p>
          <Link href="/recordings" className="btn-secondary" style={{ marginTop: 16 }}>
            ← Back to Recordings
          </Link>
        </div>
      </div>
    );
  }

  const date = new Date(recording.createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="playback-container">
      {/* Header */}
      <div className="playback-header">
        <Link href="/recordings" className="playback-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5" />
            <polyline points="12,19 5,12 12,5" />
          </svg>
          Back to Recordings
        </Link>

        <h1>{recording.title}</h1>

        <div className="playback-meta">
          <span>{dateStr} at {timeStr}</span>
          <span>•</span>
          <span>{formatDuration(recording.duration)}</span>
          <span>•</span>
          <span>{formatBytes(recording.fileSize)}</span>
          {recording.meetingCode && (
            <>
              <span>•</span>
              <span style={{ color: 'var(--cyan)' }}>{recording.meetingCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Audio Player */}
      <AudioPlayer src={recording.fileUrl} title="Playback" />

      {/* Transcript Section */}
      <div className="transcript-section">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Transcript & Summary
        </h2>

        {recording.summary ? (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Summary</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
              {recording.summary}
            </p>
          </div>
        ) : null}

        {recording.keyPoints && recording.keyPoints.length > 0 ? (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Key Points</h3>
            <ul style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
              {recording.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {recording.transcript ? (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Full Transcript</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {recording.transcript}
            </p>
          </div>
        ) : (
          <div className="transcript-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <p>AI transcription & summary coming soon.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>This feature will be available in Phase 3.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
