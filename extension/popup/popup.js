// ============================================================
// Meet Recorder — Popup Script
// Controls recording state, timer, UI updates
// ============================================================

// -----------------------------------------------------------
// DOM Elements
// -----------------------------------------------------------
const recordBtn = document.getElementById('recordBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const recordingControls = document.getElementById('recordingControls');
const recordHint = document.getElementById('recordHint');
const timerValue = document.getElementById('timerValue');
const timerLabel = document.getElementById('timerLabel');
const timerProgress = document.getElementById('timerProgress');
const statusDot = document.getElementById('statusDot');
const meetBanner = document.getElementById('meetBanner');
const meetStatus = document.getElementById('meetStatus');
const micCheckbox = document.getElementById('micCheckbox');
const recordingsList = document.getElementById('recordingsList');
const recordingCount = document.getElementById('recordingCount');
const emptyState = document.getElementById('emptyState');

let isRecording = false;
let isPaused = false;
let timerInterval = null;
let recordingStartTime = null;
let pauseStartedAt = null;
let totalPausedMs = 0;

// -----------------------------------------------------------
// Initialization
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  const bgOk = await checkBackgroundReady();
  if (!bgOk) {
    recordBtn.disabled = true;
    recordHint.textContent = 'Background not running. Reload extension in chrome://extensions';
    return;
  }

  // Add gradient def to timer SVG
  addTimerGradient();

  // Check if on Google Meet
  await checkMeetTab();

  // Get current recording status
  await syncRecordingState();

  // Load recent recordings
  await loadRecordings();

  // Load mic preference
  const stored = await chrome.storage.local.get('includeMic');
  if (stored.includeMic !== undefined) {
    micCheckbox.checked = stored.includeMic;
  }

  // Request microphone permission immediately on load (if enabled)
  await requestPermissionsOnLoad();
});

async function checkBackgroundReady() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        resolve(false);
        return;
      }
      resolve(Boolean(response?.success));
    });
  });
}

// -----------------------------------------------------------
// Request permissions on popup load
// -----------------------------------------------------------
async function requestPermissionsOnLoad() {
  // Request tab capture permission immediately
  try {
    // This will prompt for permission if not granted
    const result = await chrome.permissions.request({
      permissions: ['tabCapture']
    });
    console.log('Tab capture permission:', result);
  } catch (error) {
    console.log('Tab capture permission error:', error);
  }

  // Also check/request microphone if enabled
  const stored = await chrome.storage.local.get('includeMic');
  if (stored.includeMic) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
    } catch (error) {
      console.log('Microphone permission not granted yet');
    }
  }
}

// -----------------------------------------------------------
// Timer Gradient (injected via JS since SVG defs in CSS are tricky)
// -----------------------------------------------------------
function addTimerGradient() {
  const svg = document.querySelector('.timer-svg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
  `;
  svg.prepend(defs);
  timerProgress.setAttribute('stroke', 'url(#timerGrad)');
}

// -----------------------------------------------------------
// Meet Tab Detection
// -----------------------------------------------------------
async function checkMeetTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true };
    if (tab && tab.url && tab.url.includes('meet.google.com')) {
      meetBanner.classList.add('detected');
      meetBanner.classList.remove('not-detected');
      meetStatus.textContent = 'Google Meet detected';
      statusDot.classList.add('active');
      recordBtn.disabled = false;
    } else {
      meetBanner.classList.add('not-detected');
      meetBanner.classList.remove('detected');
      meetStatus.textContent = 'Not on Google Meet — navigate to a Meet tab';
      statusDot.classList.remove('active');
      recordBtn.disabled = true;
      recordHint.textContent = 'Open Google Meet to start recording';
    }
  } catch (error) {
    console.error('Error checking tab:', error);
  }
}

// -----------------------------------------------------------
// Sync Recording State
// -----------------------------------------------------------
async function syncRecordingState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get-status' }, (response) => {
      if (response && response.recording) {
        isRecording = true;
        recordingStartTime = response.recordingStartTime;
        isPaused = Boolean(response.recordingPaused);
        pauseStartedAt = response.pauseStartedAt || null;
        totalPausedMs = response.totalPausedMs || 0;
        setRecordingUI(true);
        startTimer();
      } else {
        isRecording = false;
        isPaused = false;
        setRecordingUI(false);
      }
      resolve();
    });
  });
}

// -----------------------------------------------------------
// Record Button Click
// -----------------------------------------------------------
recordBtn.addEventListener('click', async () => {
  if (recordBtn.disabled) return;
  // Start recording
  recordBtn.disabled = true;
  recordHint.textContent = 'Starting...';

  const includeMic = micCheckbox.checked;
  await chrome.storage.local.set({ includeMic });

  // Check microphone permission if mic is enabled
  if (includeMic) {
    const micAllowed = await ensureMicrophonePermission();
    if (!micAllowed) {
      recordBtn.disabled = false;
      recordHint.textContent = 'Microphone permission denied';
      setTimeout(() => {
        recordHint.textContent = 'Click to start recording';
      }, 3000);
      return;
    }
  }

  const startResult = await sendMessageWithRetry({ type: 'start-recording', includeMic }, 2);
  recordBtn.disabled = false;

  if (startResult?.success) {
    isRecording = true;
    isPaused = false;
    pauseStartedAt = null;
    totalPausedMs = 0;
    recordingStartTime = Date.now();
    setRecordingUI(true);
    startTimer();
    return;
  }

  // First-click race can return no response while background is waking.
  // Sync once before showing error to avoid false negatives.
  await syncRecordingState();
  if (isRecording) {
    recordHint.textContent = 'Recording started';
    return;
  }

  if (startResult?.error) {
    try {
      const debug = await chrome.storage.local.get(['lastOffscreenStartResponse', 'lastOffscreenStartAt']);
      const offscreenErr = debug?.lastOffscreenStartResponse?.error;
      if (offscreenErr) {
        recordHint.textContent = `${startResult.error} — ${offscreenErr}`;
      } else {
        recordHint.textContent = startResult.error;
      }
    } catch {
      recordHint.textContent = startResult.error;
    }
  } else {
    recordHint.textContent = 'Failed to start (background unavailable)';
  }
  setTimeout(() => {
    recordHint.textContent = 'Click to start recording';
  }, 3000);
});

async function ensureMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.warn('Microphone permission denied:', error);
    return false;
  }
}

async function sendMessageWithRetry(message, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          resolve({ success: false, error: runtimeError.message || 'Extension runtime error' });
          return;
        }
        resolve(response || { success: false, error: 'No response from background' });
      });
    });

    if (result?.success) return result;
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      return result;
    }
  }
}

pauseBtn.addEventListener('click', () => {
  if (!isRecording) return;
  pauseBtn.disabled = true;

  if (!isPaused) {
    chrome.runtime.sendMessage({ type: 'pause-recording' }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      pauseBtn.disabled = false;
      if (runtimeError) {
        recordHint.textContent = `Pause error: ${runtimeError.message || 'Extension runtime error'}`;
        return;
      }
      if (response?.success) {
        isPaused = true;
        pauseStartedAt = Date.now();
        setRecordingUI(true);
      } else {
        recordHint.textContent = response?.error || 'Failed to pause';
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: 'resume-recording' }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      pauseBtn.disabled = false;
      if (runtimeError) {
        recordHint.textContent = `Resume error: ${runtimeError.message || 'Extension runtime error'}`;
        return;
      }
      if (response?.success) {
        if (pauseStartedAt) {
          totalPausedMs += Date.now() - pauseStartedAt;
        }
        pauseStartedAt = null;
        isPaused = false;
        setRecordingUI(true);
      } else {
        recordHint.textContent = response?.error || 'Failed to resume';
      }
    });
  }
});

stopBtn.addEventListener('click', () => {
  if (!isRecording) return;
  stopBtn.disabled = true;
  pauseBtn.disabled = true;
  recordHint.textContent = 'Stopping...';

  chrome.runtime.sendMessage({ type: 'stop-recording' }, async (response) => {
    const runtimeError = chrome.runtime.lastError;

    // Always reset local state — even on error the recording is effectively done
    isRecording = false;
    isPaused = false;
    pauseStartedAt = null;
    totalPausedMs = 0;
    setRecordingUI(false);
    stopTimer();

    // Re-check Meet tab so the record button is properly enabled/disabled
    await checkMeetTab();

    stopBtn.disabled = false;
    pauseBtn.disabled = true;

    if (runtimeError) {
      recordHint.textContent = `Stop error: ${runtimeError.message || 'Extension runtime error'}`;
      setTimeout(() => {
        recordHint.textContent = 'Click to start recording';
      }, 3000);
      return;
    }

    if (response && response.success) {
      recordHint.textContent = 'Recording saved!';
      setTimeout(() => {
        recordHint.textContent = 'Click to start recording';
        loadRecordings();
      }, 2000);
    } else {
      recordHint.textContent = response?.error || 'Failed to stop';
      setTimeout(() => {
        recordHint.textContent = 'Click to start recording';
      }, 3000);
    }
  });
});

// -----------------------------------------------------------
// Mic Toggle — save preference
// -----------------------------------------------------------
micCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ includeMic: micCheckbox.checked });
});

// -----------------------------------------------------------
// Timer
// -----------------------------------------------------------
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!recordingStartTime) return;
    const currentPauseMs = isPaused && pauseStartedAt ? Date.now() - pauseStartedAt : 0;
    const elapsedMs = Math.max(0, Date.now() - recordingStartTime - totalPausedMs - currentPauseMs);
    const elapsed = Math.floor(elapsedMs / 1000);
    timerValue.textContent = formatTime(elapsed);

    // Animate ring (full rotation every 60 seconds)
    const progress = (elapsed % 60) / 60;
    const circumference = 2 * Math.PI * 54; // radius = 54
    timerProgress.style.strokeDashoffset = circumference * (1 - progress);
  }, 200);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerValue.textContent = '00:00';
  timerProgress.style.strokeDashoffset = 339.292;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// -----------------------------------------------------------
// UI State Management
// -----------------------------------------------------------
function setRecordingUI(recording) {
  if (recording) {
    recordBtn.classList.add('recording');
    recordBtn.style.display = 'none';
    recordingControls.style.display = 'flex';
    recordingControls.classList.add('visible');
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    recordHint.textContent = isPaused ? 'Recording paused' : 'Recording in progress';
    timerLabel.textContent = isPaused ? 'Paused' : 'Recording';
    timerLabel.classList.add('recording');
    statusDot.classList.toggle('recording', !isPaused);
    statusDot.classList.toggle('active', isPaused);
    // Disable mic toggle during recording
    micCheckbox.disabled = true;
    document.getElementById('micToggle').style.opacity = '0.5';
  } else {
    // FIX: Show the record button when NOT recording
    recordBtn.classList.remove('recording');
    recordBtn.style.display = 'flex';
    recordingControls.style.display = 'none';
    recordingControls.classList.remove('visible');
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    recordHint.textContent = 'Click to start recording';
    timerLabel.textContent = 'Ready';
    timerLabel.classList.remove('recording');
    statusDot.classList.remove('recording');
    statusDot.classList.add('active');
    // Re-enable mic toggle
    micCheckbox.disabled = false;
    document.getElementById('micToggle').style.opacity = '1';
  }
}

// -----------------------------------------------------------
// Load Recent Recordings
// -----------------------------------------------------------
async function loadRecordings() {
  const stored = await chrome.storage.local.get('recordings');
  const recordings = stored.recordings || [];

  recordingCount.textContent = recordings.length;

  if (recordings.length === 0) {
    recordingsList.innerHTML = '';
    recordingsList.appendChild(createEmptyState());
    return;
  }

  recordingsList.innerHTML = '';

  // Show last 5 recordings
  const recent = recordings.slice(0, 5);
  recent.forEach((rec) => {
    recordingsList.appendChild(createRecordingCard(rec));
  });
}

function createEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10,8 16,12 10,16"/>
    </svg>
    <p>No recordings yet</p>
  `;
  return div;
}

function createRecordingCard(rec) {
  const card = document.createElement('div');
  card.className = 'recording-card';

  const date = new Date(rec.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const duration = formatTime(rec.duration || 0);
  const size = formatBytes(rec.fileSize || 0);
  const uploadStatus = rec.uploaded ? 'Uploaded' : 'Local only';
  const uploadTitle = rec.uploadError ? ` title="${escapeHtml(rec.uploadError)}"` : '';

  card.innerHTML = `
    <div class="recording-card-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    </div>
    <div class="recording-card-info">
      <div class="recording-card-title">${escapeHtml(rec.title || 'Meet Recording')}</div>
      <div class="recording-card-meta">
        <span>${dateStr} ${timeStr}</span>
        <span class="dot"></span>
        <span>${duration}</span>
        <span class="dot"></span>
        <span>${size}</span>
        <span class="dot"></span>
        <span${uploadTitle}>${uploadStatus}</span>
      </div>
    </div>
  `;

  return card;
}

// -----------------------------------------------------------
// Utilities
// -----------------------------------------------------------
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// -----------------------------------------------------------
// Dashboard Link
// -----------------------------------------------------------
document.getElementById('openDashboard').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:3000' });
});