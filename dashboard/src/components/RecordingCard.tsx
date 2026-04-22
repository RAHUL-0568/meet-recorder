// ============================================================
// RecordingCard Component — Card for each recording in the list
// ============================================================

"use client";

import Link from "next/link";
import { useState } from "react";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </div>
          </div>

          {/* Info */}
          <div className="rec-card-info">
            <h3 className="rec-card-title">{title}</h3>
            <div className="rec-card-meta">
              <span className="rec-card-date">
                {dateStr} at {timeStr}
              </span>
              <span className="rec-card-dot">•</span>
              <span className="rec-card-duration">
                {formatDuration(duration)}
              </span>
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
              setShowDeleteModal(true);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3,6 5,6 21,6" />
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="delete-overlay"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            {/* Danger stripe at top */}
            <div className="delete-modal-stripe" />

            {/* Close */}
            <button
              className="delete-modal-close"
              onClick={() => !deleting && setShowDeleteModal(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Content */}
            <div className="delete-modal-body">
              {/* Icon */}
              <div className="delete-modal-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>

              <h3 className="delete-modal-title">Delete this recording?</h3>
              <p className="delete-modal-desc">
                This action cannot be undone. The audio file and all data for
                this recording will be permanently removed.
              </p>

              {/* Recording being deleted */}
              <div className="delete-modal-target">
                <div className="delete-modal-target-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 12a4 4 0 0 1-8 0" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                  </svg>
                </div>
                <div className="delete-modal-target-info">
                  <span className="delete-modal-target-name">{title}</span>
                  <span className="delete-modal-target-meta">
                    {dateStr} &middot; {formatDuration(duration)} &middot;{" "}
                    {formatBytes(fileSize)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Keep Recording
              </button>
              <button
                className="delete-modal-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="delete-spinner" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
