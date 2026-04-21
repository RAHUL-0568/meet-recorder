// ============================================================
// Landing Page — Hero + Install Guide + Features
// ============================================================

"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Download the extension zip and show the install guide
  const handleInstall = async () => {
    setShowGuide(true);
    setDownloading(true);
    try {
      const res = await fetch("/api/download-extension");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meet-recorder-extension.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="hero" id="hero">
        <div className="hero-badge">
          <span>Chrome Extension for Google Meet</span>
        </div>

        <h1>
          Record every meeting.
          <br />
          <span className="hero-gradient-text">Miss nothing.</span>
        </h1>

        <p>
          A lightweight Chrome extension that captures your Google Meet audio,
          syncs to the cloud, and lets you review every conversation.
        </p>

        <div className="hero-actions">
          {/* Primary CTA — Download & Install Extension */}
          <button
            className="btn-chrome"
            id="install-extension-hero"
            onClick={handleInstall}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="12"
                r="4"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <line
                x1="12"
                y1="2"
                x2="12"
                y2="8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <line
                x1="3.5"
                y1="17"
                x2="8.5"
                y2="14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <line
                x1="20.5"
                y1="17"
                x2="15.5"
                y2="14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Add to Chrome — It&apos;s Free
          </button>

          {session ? (
            <button
              className="btn-primary"
              onClick={() => router.push("/recordings")}
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
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Open Dashboard
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => signIn("google")}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10,17 15,12 10,7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign In to Dashboard
            </button>
          )}
        </div>

        <p className="hero-trust">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Free &amp; open-source · No data collection · Syncs to cloud
        </p>
      </section>

      {/* ── Install Section ── */}
      <section className="install-section" id="install">
        <div className="install-inner">
          <div className="install-header">
            <div className="install-badge">Get Started</div>
            <h2>Install in seconds</h2>
            <p>
              Three quick steps and you&apos;re recording your next meeting.
            </p>
          </div>

          <div className="install-steps">
            {/* Step 1 */}
            <div className="install-step">
              <div className="install-step-number">1</div>
              <div className="install-step-icon blue">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <h3>Download Extension</h3>
              <p>
                Click &ldquo;Add to Chrome&rdquo; above to download the
                extension package as a zip file.
              </p>
            </div>

            {/* Connector */}
            <div className="install-step-connector">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>

            {/* Step 2 */}
            <div className="install-step">
              <div className="install-step-number">2</div>
              <div className="install-step-icon green">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <h3>Load in Chrome</h3>
              <p>
                Go to <strong>chrome://extensions</strong>, enable Developer
                Mode, and load the unpacked folder.
              </p>
            </div>

            {/* Connector */}
            <div className="install-step-connector">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>

            {/* Step 3 */}
            <div className="install-step">
              <div className="install-step-number">3</div>
              <div className="install-step-icon violet">
                <svg
                  width="24"
                  height="24"
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
              <h3>Start Recording</h3>
              <p>
                Join a Google Meet, click the extension icon, and hit record.
                It&apos;s that simple.
              </p>
            </div>
          </div>

          {/* CTA Box */}
          <div className="install-cta-box">
            <div className="install-cta-content">
              <div className="install-cta-text">
                <h3>Ready to never miss a meeting detail again?</h3>
                <p>
                  Install Meet Recorder and start capturing your conversations
                  today.
                </p>
              </div>
              <button
                className="btn-chrome"
                id="install-extension-cta"
                onClick={handleInstall}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <line
                    x1="12"
                    y1="2"
                    x2="12"
                    y2="8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <line
                    x1="3.5"
                    y1="17"
                    x2="8.5"
                    y2="14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <line
                    x1="20.5"
                    y1="17"
                    x2="15.5"
                    y2="14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                Add to Chrome — Free
              </button>
            </div>
            <div className="install-cta-note">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Works on Chrome, Edge, Brave, and other Chromium browsers
            </div>
            <div className="install-cta-note login-note">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10,17 15,12 10,7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              You must be signed in on the website to use the extension
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="features-header">
          <h2>Built for productive teams</h2>
          <p>
            Everything you need to capture, review, and share meeting knowledge.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon purple">
              <svg
                width="20"
                height="20"
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
            <h3>One-Click Recording</h3>
            <p>
              Start recording from the popup — captures tab audio and your
              microphone at the same time. No complicated setup.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon cyan">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h3>Waveform Playback</h3>
            <p>
              Review recordings with an interactive waveform viewer. Skip, speed
              up, and visually navigate through your meetings.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon green">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>Secure Cloud Sync</h3>
            <p>
              Recordings sync to your private cloud bucket. Encrypted and
              accessible only to you. Sign in with Google to get started.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon amber">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 12 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>AI Summaries</h3>
            <p>
              Automatic transcription, action items, and key decisions extracted
              from every call. Coming soon.
            </p>
          </div>
        </div>
      </section>

      {/* ── Install Guide Modal ── */}
      {showGuide && (
        <div className="guide-overlay" onClick={() => setShowGuide(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="guide-close" onClick={() => setShowGuide(false)}>
              <svg
                width="18"
                height="18"
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

            {/* Header */}
            <div className="guide-header">
              <div className="guide-icon-wrapper">
                {downloading ? (
                  <div className="guide-spinner" />
                ) : (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <h2>
                {downloading ? "Downloading..." : "Extension Downloaded!"}
              </h2>
              <p>
                {downloading
                  ? "Preparing your extension package..."
                  : "Now follow these steps to install it in Chrome:"}
              </p>
            </div>

            {/* Steps */}
            <div className="guide-steps">
              <div className={`guide-step ${downloaded ? "done" : ""}`}>
                <div className="guide-step-num">
                  {downloaded ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    "1"
                  )}
                </div>
                <div className="guide-step-body">
                  <h3>Unzip the downloaded file</h3>
                  <p>
                    Extract <code>meet-recorder-extension.zip</code> to a folder
                    on your computer. Remember this location.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">2</div>
                <div className="guide-step-body">
                  <h3>Open Chrome Extensions page</h3>
                  <p>
                    Type <code>chrome://extensions</code> in your address bar
                    and press Enter.
                    <br />
                    Or go to <strong>Menu → More Tools → Extensions</strong>.
                  </p>
                  <button
                    className="guide-copy-btn"
                    onClick={() =>
                      navigator.clipboard.writeText("chrome://extensions")
                    }
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy URL
                  </button>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">3</div>
                <div className="guide-step-body">
                  <h3>Enable Developer Mode</h3>
                  <p>
                    Toggle the <strong>&ldquo;Developer mode&rdquo;</strong>{" "}
                    switch in the top-right corner of the extensions page.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">4</div>
                <div className="guide-step-body">
                  <h3>Load the extension</h3>
                  <p>
                    Click <strong>&ldquo;Load unpacked&rdquo;</strong> and
                    select the extracted folder. The Meet Recorder icon will
                    appear in your toolbar!
                  </p>
                </div>
              </div>
            </div>

            {/* Login Requirement Note */}
            <div className="guide-login-note">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>
                <strong>Important:</strong> You must be signed in on the website
                before using the extension. Your recordings will sync to your
                account.
              </p>
            </div>

            {/* Footer */}
            <div className="guide-footer">
              <button
                className="guide-done-btn"
                onClick={() => setShowGuide(false)}
              >
                Got it!
              </button>
              {!downloaded && (
                <button className="guide-retry-btn" onClick={handleInstall}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
