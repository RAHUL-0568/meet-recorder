// ============================================================
// Meet Recorder — Content Script
// Injected into Google Meet pages
// Detects active meetings and shows recording indicator
// ============================================================

let isRecording = false;
let indicatorElement = null;

// -----------------------------------------------------------
// Create Floating Recording Indicator
// -----------------------------------------------------------
function createIndicator() {
  if (indicatorElement) return;

  indicatorElement = document.createElement('div');
  indicatorElement.id = 'meet-recorder-indicator';
  indicatorElement.innerHTML = `
    <div class="mr-indicator-dot"></div>
    <span class="mr-indicator-text">REC</span>
    <span class="mr-indicator-timer" id="mr-timer">00:00</span>
  `;

  document.body.appendChild(indicatorElement);
}

function removeIndicator() {
  if (indicatorElement) {
    indicatorElement.remove();
    indicatorElement = null;
  }
}

// -----------------------------------------------------------
// Timer in Indicator
// -----------------------------------------------------------
let indicatorInterval = null;
let indicatorStartTime = null;

function startIndicatorTimer() {
  indicatorStartTime = Date.now();
  indicatorInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - indicatorStartTime) / 1000);
    const timer = document.getElementById('mr-timer');
    if (timer) {
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }, 1000);
}

function stopIndicatorTimer() {
  if (indicatorInterval) {
    clearInterval(indicatorInterval);
    indicatorInterval = null;
  }
}

// -----------------------------------------------------------
// Message Listener
// -----------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'recording-status') {
    isRecording = message.recording;

    if (isRecording) {
      createIndicator();
      startIndicatorTimer();
    } else {
      stopIndicatorTimer();
      removeIndicator();
    }

    sendResponse({ success: true });
  }
});

// -----------------------------------------------------------
// Detect Meeting State
// -----------------------------------------------------------
function detectMeeting() {
  // Check if we're in an active meeting by looking for known Meet UI elements
  const inMeeting = !!(
    document.querySelector('[data-meeting-title]') ||
    document.querySelector('[data-call-ended]') === null &&
    document.querySelector('[jscontroller]') &&
    window.location.pathname.match(/\/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
  );

  return inMeeting;
}

// Send meeting info to background on load
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
      timestamp: new Date().toISOString()
    }
  }).catch(() => {});
}

// Check meeting state on load
if (detectMeeting()) {
  sendMeetingInfo();
}

// -----------------------------------------------------------
// On page load, sync recording state
// -----------------------------------------------------------
chrome.storage.local.get(['recording', 'recordingStartTime'], (stored) => {
  if (stored.recording) {
    isRecording = true;
    createIndicator();
    indicatorStartTime = stored.recordingStartTime || Date.now();

    indicatorInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - indicatorStartTime) / 1000);
      const timer = document.getElementById('mr-timer');
      if (timer) {
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);
  }
});
