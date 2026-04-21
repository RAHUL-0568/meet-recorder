// Meet Recorder - Content Script
// Shows an in-page recording indicator on Google Meet and keeps it synced to extension state.

let isRecording = false;
let isPaused = false;
let indicatorElement = null;
let indicatorTimer = null;
let indicatorStartTime = null;
let pauseStartedAt = null;
let totalPausedMs = 0;

function createIndicator() {
  if (indicatorElement) {
    return indicatorElement;
  }

  indicatorElement = document.createElement('div');
  indicatorElement.id = 'meet-recorder-indicator';
  indicatorElement.innerHTML = `
    <div class="mr-indicator-dot" id="mr-indicator-dot"></div>
    <span class="mr-indicator-text" id="mr-indicator-text">REC</span>
    <span class="mr-indicator-timer" id="mr-timer">00:00</span>
  `;

  document.body.appendChild(indicatorElement);
  return indicatorElement;
}

function removeIndicator() {
  if (!indicatorElement) {
    return;
  }

  indicatorElement.remove();
  indicatorElement = null;
}

function stopIndicatorTimer() {
  if (indicatorTimer) {
    clearInterval(indicatorTimer);
    indicatorTimer = null;
  }
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getElapsedSeconds() {
  if (!indicatorStartTime) {
    return 0;
  }

  const activePauseMs = isPaused && pauseStartedAt ? Date.now() - pauseStartedAt : 0;
  const elapsedMs = Math.max(
    0,
    Date.now() - indicatorStartTime - totalPausedMs - activePauseMs
  );

  return Math.floor(elapsedMs / 1000);
}

function renderIndicator() {
  if (!isRecording) {
    stopIndicatorTimer();
    removeIndicator();
    return;
  }

  createIndicator();

  const text = document.getElementById('mr-indicator-text');
  const dot = document.getElementById('mr-indicator-dot');
  const timer = document.getElementById('mr-timer');

  if (text) {
    text.textContent = isPaused ? 'PAUSED' : 'REC';
    text.classList.toggle('paused', isPaused);
  }

  if (dot) {
    dot.classList.toggle('paused', isPaused);
  }

  if (indicatorElement) {
    indicatorElement.classList.toggle('paused', isPaused);
  }

  if (timer) {
    timer.textContent = formatTime(getElapsedSeconds());
  }

  stopIndicatorTimer();

  if (!isPaused) {
    indicatorTimer = setInterval(() => {
      const liveTimer = document.getElementById('mr-timer');
      if (liveTimer) {
        liveTimer.textContent = formatTime(getElapsedSeconds());
      }
    }, 1000);
  }
}

function applyRecordingState(state) {
  isRecording = Boolean(state.recording);
  isPaused = Boolean(state.recordingPaused);
  indicatorStartTime = state.recordingStartTime || null;
  pauseStartedAt = state.pauseStartedAt || null;
  totalPausedMs = state.totalPausedMs || 0;
  renderIndicator();
}

async function syncFromStorage() {
  const stored = await chrome.storage.local.get([
    'recording',
    'recordingStartTime',
    'recordingPaused',
    'pauseStartedAt',
    'totalPausedMs',
  ]);

  applyRecordingState(stored);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'recording-status') {
    return false;
  }

  applyRecordingState(message);
  sendResponse({ success: true });
  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (
    changes.recording ||
    changes.recordingStartTime ||
    changes.recordingPaused ||
    changes.pauseStartedAt ||
    changes.totalPausedMs
  ) {
    syncFromStorage().catch(() => {});
  }
});

function detectMeeting() {
  return Boolean(
    document.querySelector('[data-meeting-title]') ||
      (
        document.querySelector('[data-call-ended]') === null &&
        document.querySelector('[jscontroller]') &&
        window.location.pathname.match(/\/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
      )
  );
}

function sendMeetingInfo() {
  const meetingCode = window.location.pathname.split('/').pop();
  const titleEl = document.querySelector('[data-meeting-title]');
  const title = titleEl?.textContent || `Meet: ${meetingCode}`;

  chrome.runtime.sendMessage({
    type: 'meeting-info',
    data: {
      meetingCode,
      title,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    },
  }).catch(() => {});
}

if (detectMeeting()) {
  sendMeetingInfo();
}

syncFromStorage().catch(() => {});
