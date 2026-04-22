// Meet Recorder - Popup Script
// Controls recording state, timer, and popup UI.

const recordBtn = document.getElementById("recordBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const recordingControls = document.getElementById("recordingControls");
const recordHint = document.getElementById("recordHint");
const timerValue = document.getElementById("timerValue");
const timerLabel = document.getElementById("timerLabel");
const timerProgress = document.getElementById("timerProgress");
const statusDot = document.getElementById("statusDot");
const meetBanner = document.getElementById("meetBanner");
const meetStatus = document.getElementById("meetStatus");
const micCheckbox = document.getElementById("micCheckbox");
const micToggle = document.getElementById("micToggle");
const recordingsList = document.getElementById("recordingsList");
const recordingCount = document.getElementById("recordingCount");
const openDashboardLink = document.getElementById("openDashboard");
const DEFAULT_DASHBOARD_ORIGIN = "http://localhost:3000";

let isRecording = false;
let isPaused = false;
let timerInterval = null;
let recordingStartTime = null;
let pauseStartedAt = null;
let totalPausedMs = 0;

document.addEventListener("DOMContentLoaded", async () => {
  const backgroundReady = await checkBackgroundReady();

  addTimerGradient();
  await loadMicPreference();
  await checkMeetTab();
  await syncRecordingState();
  await loadRecordings();

  if (!backgroundReady && !isRecording) {
    recordHint.textContent =
      "Recorder waking up. If start fails once, try again.";
  }

  chrome.storage.onChanged.addListener(handleStorageChanges);
});

async function checkBackgroundReady() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ok = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "ping" }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          resolve(false);
          return;
        }

        resolve(Boolean(response?.success));
      });
    });

    if (ok) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function loadMicPreference() {
  const stored = await chrome.storage.local.get("includeMic");
  if (stored.includeMic !== undefined) {
    micCheckbox.checked = Boolean(stored.includeMic);
  }
}

function addTimerGradient() {
  const svg = document.querySelector(".timer-svg");
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"></stop>
      <stop offset="100%" stop-color="#06B6D4"></stop>
    </linearGradient>
  `;
  svg.prepend(defs);
  timerProgress.setAttribute("stroke", "url(#timerGrad)");
}

async function checkMeetTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const onMeetTab = Boolean(tab?.url?.includes("meet.google.com"));

    if (onMeetTab) {
      meetBanner.classList.add("detected");
      meetBanner.classList.remove("not-detected");
      meetStatus.textContent = "Google Meet detected";
      if (!isRecording) {
        statusDot.classList.add("active");
        recordBtn.disabled = false;
      }
      return onMeetTab;
    }

    meetBanner.classList.add("not-detected");
    meetBanner.classList.remove("detected");
    meetStatus.textContent = isRecording
      ? "Recording continues even if you switch tabs"
      : "Not on Google Meet - navigate to a Meet tab";

    if (!isRecording) {
      statusDot.classList.remove("active");
      recordBtn.disabled = true;
      recordHint.textContent = "Open Google Meet to start recording";
    }

    return onMeetTab;
  } catch (error) {
    console.error("Error checking tab:", error);
    return false;
  }
}

async function syncRecordingState() {
  const status = await getRecordingStatus();

  isRecording = Boolean(status.recording);
  recordingStartTime = status.recordingStartTime || null;
  isPaused = Boolean(status.recordingPaused);
  pauseStartedAt = status.pauseStartedAt || null;
  totalPausedMs = status.totalPausedMs || 0;

  setRecordingUI(isRecording);

  if (isRecording) {
    startTimer();
    await checkMeetTab();
    return;
  }

  stopTimer();
  await checkMeetTab();
}

async function getRecordingStatus() {
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "get-status" }, (result) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        resolve(null);
        return;
      }

      resolve(result || null);
    });
  });

  if (response) {
    return response;
  }

  const stored = await chrome.storage.local.get([
    "recording",
    "recordingStartTime",
    "recordingPaused",
    "pauseStartedAt",
    "totalPausedMs",
  ]);

  return {
    recording: Boolean(stored.recording),
    recordingStartTime: stored.recordingStartTime || null,
    recordingPaused: Boolean(stored.recordingPaused),
    pauseStartedAt: stored.pauseStartedAt || null,
    totalPausedMs: stored.totalPausedMs || 0,
  };
}

recordBtn.addEventListener("click", async () => {
  if (recordBtn.disabled) {
    return;
  }

  recordBtn.disabled = true;
  recordHint.textContent = "Starting...";

  const includeMic = micCheckbox.checked;
  await chrome.storage.local.set({ includeMic });

  const startResult = await sendMessageWithRetry(
    { type: "start-recording", includeMic },
    2,
  );

  recordBtn.disabled = false;

  // 🔐 AUTH CHECK (ONLY ADDITION)
  if (startResult?.requiresAuth) {
    recordHint.textContent = "Login required";
    const dashboardUrl = await getDashboardOrigin();

    chrome.tabs.create({
      url: dashboardUrl,
    });

    return;
  }

  if (startResult?.success) {
    isRecording = true;
    isPaused = false;
    pauseStartedAt = null;
    totalPausedMs = 0;
    recordingStartTime = Date.now();
    setRecordingUI(true);
    startTimer();
    await checkMeetTab();
    return;
  }

  await syncRecordingState();
  if (isRecording) {
    recordHint.textContent = "Recording started";
    return;
  }

  recordHint.textContent = startResult?.error || "Failed to start recording";
  setTimeout(() => {
    if (!isRecording) {
      recordHint.textContent = "Click to start recording";
    }
  }, 3000);
});

pauseBtn.addEventListener("click", () => {
  if (!isRecording) {
    return;
  }

  pauseBtn.disabled = true;

  if (!isPaused) {
    chrome.runtime.sendMessage({ type: "pause-recording" }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      pauseBtn.disabled = false;

      if (runtimeError) {
        recordHint.textContent = `Pause error: ${runtimeError.message || "Extension runtime error"}`;
        return;
      }

      if (!response?.success) {
        recordHint.textContent = response?.error || "Failed to pause";
        return;
      }

      isPaused = true;
      pauseStartedAt = Date.now();
      setRecordingUI(true);
    });
    return;
  }

  chrome.runtime.sendMessage({ type: "resume-recording" }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    pauseBtn.disabled = false;

    if (runtimeError) {
      recordHint.textContent = `Resume error: ${runtimeError.message || "Extension runtime error"}`;
      return;
    }

    if (!response?.success) {
      recordHint.textContent = response?.error || "Failed to resume";
      return;
    }

    if (pauseStartedAt) {
      totalPausedMs += Date.now() - pauseStartedAt;
    }

    pauseStartedAt = null;
    isPaused = false;
    setRecordingUI(true);
  });
});

stopBtn.addEventListener("click", () => {
  if (!isRecording) {
    return;
  }

  stopBtn.disabled = true;
  pauseBtn.disabled = true;
  recordHint.textContent = "Stopping...";

  chrome.runtime.sendMessage({ type: "stop-recording" }, async (response) => {
    const runtimeError = chrome.runtime.lastError;

    isRecording = false;
    isPaused = false;
    pauseStartedAt = null;
    totalPausedMs = 0;
    setRecordingUI(false);
    stopTimer();
    await checkMeetTab();

    stopBtn.disabled = false;
    pauseBtn.disabled = true;

    if (runtimeError) {
      recordHint.textContent = `Stop error: ${runtimeError.message || "Extension runtime error"}`;
      setTimeout(() => {
        recordHint.textContent = "Click to start recording";
      }, 3000);
      return;
    }

    if (response?.success) {
      recordHint.textContent = "Recording saved!";
      setTimeout(async () => {
        recordHint.textContent = "Click to start recording";
        await loadRecordings();
      }, 1500);
      return;
    }

    recordHint.textContent = response?.error || "Failed to stop";
    setTimeout(() => {
      recordHint.textContent = "Click to start recording";
    }, 3000);
  });
});

micCheckbox.addEventListener("change", () => {
  chrome.storage.local.set({ includeMic: micCheckbox.checked });
});

openDashboardLink.addEventListener("click", (event) => {
  event.preventDefault();
  getDashboardOrigin().then((dashboardUrl) => {
    chrome.tabs.create({ url: dashboardUrl });
  });
});

async function getDashboardOrigin() {
  const stored = await chrome.storage.local.get("dashboardOrigin");
  return stored.dashboardOrigin || DEFAULT_DASHBOARD_ORIGIN;
}

async function sendMessageWithRetry(message, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          resolve({
            success: false,
            error: runtimeError.message || "Extension runtime error",
          });
          return;
        }

        resolve(
          response || { success: false, error: "No response from background" },
        );
      });
    });

    if (result?.success) {
      return result;
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      return result;
    }
  }

  return { success: false, error: "Request failed" };
}

function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    if (!recordingStartTime) {
      return;
    }

    const currentPauseMs =
      isPaused && pauseStartedAt ? Date.now() - pauseStartedAt : 0;
    const elapsedMs = Math.max(
      0,
      Date.now() - recordingStartTime - totalPausedMs - currentPauseMs,
    );
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    timerValue.textContent = formatTime(elapsedSeconds);

    const progress = (elapsedSeconds % 60) / 60;
    const circumference = 2 * Math.PI * 54;
    timerProgress.style.strokeDashoffset = circumference * (1 - progress);
  }, 200);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerValue.textContent = "00:00";
  timerProgress.style.strokeDashoffset = 339.292;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}:${String(remainingMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function setRecordingUI(recordingActive) {
  if (recordingActive) {
    recordBtn.classList.add("recording");
    recordBtn.style.display = "none";
    recordingControls.style.display = "flex";
    recordingControls.classList.add("visible");
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    pauseBtn.textContent = isPaused ? "Resume" : "Pause";
    recordHint.textContent = isPaused
      ? "Recording paused"
      : "Recording in progress";
    timerLabel.textContent = isPaused ? "Paused" : "Recording";
    timerLabel.classList.add("recording");
    statusDot.classList.toggle("recording", !isPaused);
    statusDot.classList.toggle("active", isPaused);
    micCheckbox.disabled = true;
    micToggle.style.opacity = "0.5";
    return;
  }

  recordBtn.classList.remove("recording");
  recordBtn.style.display = "flex";
  recordingControls.style.display = "none";
  recordingControls.classList.remove("visible");
  pauseBtn.textContent = "Pause";
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  recordHint.textContent = "Click to start recording";
  timerLabel.textContent = "Ready";
  timerLabel.classList.remove("recording");
  statusDot.classList.remove("recording");
  statusDot.classList.add("active");
  micCheckbox.disabled = false;
  micToggle.style.opacity = "1";
}

async function loadRecordings() {
  const stored = await chrome.storage.local.get("recordings");
  const recordings = stored.recordings || [];

  recordingCount.textContent = recordings.length;
  recordingsList.innerHTML = "";

  if (recordings.length === 0) {
    recordingsList.appendChild(createEmptyState());
    return;
  }

  recordings.slice(0, 5).forEach((recording) => {
    recordingsList.appendChild(createRecordingCard(recording));
  });
}

function createEmptyState() {
  const container = document.createElement("div");
  container.className = "empty-state";
  container.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="10,8 16,12 10,16"></polygon>
    </svg>
    <p>No recordings yet</p>
  `;
  return container;
}

function createRecordingCard(recording) {
  const card = document.createElement("div");
  card.className = "recording-card";

  const date = new Date(recording.timestamp);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const duration = formatTime(recording.duration || 0);
  const size = formatBytes(recording.fileSize || 0);
  const uploadStatus = recording.uploaded ? "Uploaded" : "Local only";
  const uploadTitle = recording.uploadError
    ? ` title="${escapeHtml(recording.uploadError)}"`
    : "";

  card.innerHTML = `
    <div class="recording-card-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5,3 19,12 5,21"></polygon>
      </svg>
    </div>
    <div class="recording-card-info">
      <div class="recording-card-title">${escapeHtml(recording.title || "Meet Recording")}</div>
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

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(1))} ${sizes[index]}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function handleStorageChanges(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  const recordingKeys = [
    "recording",
    "recordingStartTime",
    "recordingPaused",
    "pauseStartedAt",
    "totalPausedMs",
  ];

  if (recordingKeys.some((key) => changes[key])) {
    syncRecordingState().catch((error) => {
      console.warn("Failed to sync popup recording state:", error);
    });
  }

  if (changes.recordings || changes.recordingsUpdatedAt) {
    loadRecordings().catch((error) => {
      console.warn("Failed to refresh popup recordings:", error);
    });
  }

  if (changes.includeMic) {
    micCheckbox.checked = Boolean(changes.includeMic.newValue);
  }
}
