// ============================================================
// RecordingCard Component — Card for each recording in the list
// ============================================================

'use client';

import Link from 'next/link';

interface RecordingCardProps {
  id: string;
  title: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  meetingCode?: string | null;
  onDelete?: (id: string) => void;
}

export default function RecordingCard({
  id,
  title,
  duration,
  fileSize,
  createdAt,
  meetingCode,
  onDelete,
}: RecordingCardProps) {
  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rec-card" id={`recording-${id}`}>
      <Link href={`/recordings/${id}`} className="rec-card-link">
        {/* Waveform Icon */}
        <div className="rec-card-visual">
          <div className="rec-card-waveform">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="rec-card-bar"
                style={{
                  height: `${20 + Math.sin(i * 0.8) * 60 + Math.random() * 20}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <div className="rec-card-play">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </div>
        </div>

        {/* Info */}
        <div className="rec-card-info">
          <h3 className="rec-card-title">{title}</h3>
          <div className="rec-card-meta">
            <span className="rec-card-date">{dateStr} at {timeStr}</span>
            <span className="rec-card-dot">•</span>
            <span className="rec-card-duration">{formatDuration(duration)}</span>
            <span className="rec-card-dot">•</span>
            <span className="rec-card-size">{formatBytes(fileSize)}</span>
          </div>
          {meetingCode && (
            <span className="rec-card-badge">{meetingCode}</span>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="rec-card-actions">
        <button
          className="rec-card-action-btn"
          title="Delete recording"
          onClick={(e) => {
            e.preventDefault();
            if (onDelete && confirm('Delete this recording?')) {
              onDelete(id);
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6" />
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
