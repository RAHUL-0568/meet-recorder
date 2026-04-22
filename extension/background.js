// background.js (FINAL CLEAN VERSION + AUTH + STATE PERSISTENCE)

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const DEFAULT_DASHBOARD_ORIGIN = "http://localhost:3000";

let recording = false;
let recordingTabId = null;
let recordingStartTime = null;
let recordingPaused = false;
let pauseStartedAt = null;
let totalPausedMs = 0;

// -------------------- INIT --------------------
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(["recordings"]);
  const dashboardOriginState = await chrome.storage.local.get(["dashboardOrigin"]);

  if (!existing.recordings) {
    await chrome.storage.local.set({ recordings: [] });
  }
  if (!dashboardOriginState.dashboardOrigin) {
    await chrome.storage.local.set({ dashboardOrigin: DEFAULT_DASHBOARD_ORIGIN });
  }

  // Clear stale recording state on install/update
  await clearRecordingState();

  // Open welcome page on first install to request permissions
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

// Restore in-memory state when service worker wakes up
chrome.runtime.onStartup.addListener(async () => {
  await restoreRecordingState();
});

// Also restore immediately on script load (covers service worker restart)
(async () => {
  await restoreRecordingState();
})();

// -------------------- STATE PERSISTENCE --------------------
async function saveRecordingState() {
  await chrome.storage.local.set({
    recording,
    recordingStartTime,
    recordingPaused,
    pauseStartedAt,
    totalPausedMs,
  });
}

async function clearRecordingState() {
  recording = false;
  recordingTabId = null;
  recordingStartTime = null;
  recordingPaused = false;
  pauseStartedAt = null;
  totalPausedMs = 0;

  await chrome.storage.local.set({
    recording: false,
    recordingStartTime: null,
    recordingPaused: false,
    pauseStartedAt: null,
    totalPausedMs: 0,
  });
}

async function restoreRecordingState() {
  const stored = await chrome.storage.local.get([
    "recording",
    "recordingStartTime",
    "recordingPaused",
    "pauseStartedAt",
    "totalPausedMs",
  ]);
  if (stored.recording) {
    recording = true;
    recordingStartTime = stored.recordingStartTime || null;
    recordingPaused = Boolean(stored.recordingPaused);
    pauseStartedAt = stored.pauseStartedAt || null;
    totalPausedMs = stored.totalPausedMs || 0;
    console.log("Restored recording state from storage");
  }
}

// -------------------- AUTH CHECK --------------------
async function isUserLoggedIn() {
  try {
    const { dashboardOrigin } = await chrome.storage.local.get("dashboardOrigin");
    const dashboardBaseUrl = dashboardOrigin || DEFAULT_DASHBOARD_ORIGIN;

    // Check for next-auth session cookie via chrome.cookies API
    const cookie = await chrome.cookies.get({
      url: dashboardBaseUrl,
      name: "next-auth.session-token",
    });

    if (cookie?.value) {
      return true;
    }

    // Also check the secure variant
    const secureCookie = await chrome.cookies.get({
      url: dashboardBaseUrl,
      name: "__Secure-next-auth.session-token",
    });

    return !!secureCookie?.value;
  } catch (err) {
    console.error("Auth check error:", err);
    return false;
  }
}

// -------------------- OFFSCREEN --------------------
async function createOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["USER_MEDIA"],
      justification: "Recording audio",
    });
  }
}

async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
  } catch {}
}

// -------------------- START --------------------
async function startRecording(tab, includeMic) {
  const loggedIn = await isUserLoggedIn();
  if (!loggedIn) {
    return {
      success: false,
      error: "Login required",
      requiresAuth: true,
    };
  }

  if (recording) {
    console.warn("Resetting stuck state");
    recording = false;
  }

  if (!tab?.id) {
    return { success: false, error: "No tab" };
  }

  if (!tab.url.includes("meet.google.com")) {
    return { success: false, error: "Open Google Meet" };
  }

  try {
    await closeOffscreenDocument();
    await new Promise((r) => setTimeout(r, 300));

    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(id);
        }
      });
    });

    await createOffscreenDocument();
    await new Promise((r) => setTimeout(r, 300));

    const res = await chrome.runtime.sendMessage({
      type: "start-recording",
      target: "offscreen",
      data: { streamId, includeMic },
    });

    if (!res?.success) throw new Error("Start failed");

    recording = true;
    recordingTabId = tab.id;
    recordingStartTime = Date.now();
    recordingPaused = false;
    pauseStartedAt = null;
    totalPausedMs = 0;

    await saveRecordingState();

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e.message };
  }
}

// -------------------- STOP --------------------
async function stopRecording() {
  try {
    await chrome.runtime.sendMessage({
      type: "stop-recording",
      target: "offscreen",
    });

    await clearRecordingState();

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// -------------------- SAVE METADATA --------------------
async function saveRecordingMetadata(data) {
  const stored = await chrome.storage.local.get("recordings");
  const recordings = stored.recordings || [];

  recordings.unshift({
    id: Date.now().toString(),
    title: "Meet Recording",
    filename: data.filename,
    duration: data.duration,
    fileSize: data.fileSize,
    uploaded: data.uploaded || false,
    timestamp: new Date().toISOString(),
    hasMic: data.hasMic,
  });

  await chrome.storage.local.set({ recordings });
}

// -------------------- MESSAGES --------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "ping":
      sendResponse({ success: true });
      return;

    // ✅ Return current recording state to popup
    // If service worker was suspended, restore from storage first
    case "get-status":
      (async () => {
        // If in-memory state was lost (service worker restarted), restore from storage
        if (!recording && !recordingStartTime) {
          const stored = await chrome.storage.local.get([
            "recording",
            "recordingStartTime",
            "recordingPaused",
            "pauseStartedAt",
            "totalPausedMs",
          ]);
          if (stored.recording) {
            recording = true;
            recordingStartTime = stored.recordingStartTime || null;
            recordingPaused = Boolean(stored.recordingPaused);
            pauseStartedAt = stored.pauseStartedAt || null;
            totalPausedMs = stored.totalPausedMs || 0;
          }
        }
        sendResponse({
          recording,
          recordingStartTime,
          recordingPaused,
          pauseStartedAt,
          totalPausedMs,
        });
      })();
      return true;

    case "start-recording":
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const res = await startRecording(tabs[0], Boolean(message.includeMic));
        sendResponse(res);
      });
      return true;

    case "stop-recording":
      stopRecording().then(sendResponse);
      return true;

    case "pause-recording":
      chrome.runtime
        .sendMessage({
          type: "pause-recording",
          target: "offscreen",
        })
        .then((res) => {
          if (res?.success) {
            recordingPaused = true;
            pauseStartedAt = Date.now();
            saveRecordingState();
          }
          sendResponse(res);
        });
      return true;

    case "resume-recording":
      chrome.runtime
        .sendMessage({
          type: "resume-recording",
          target: "offscreen",
        })
        .then((res) => {
          if (res?.success) {
            if (pauseStartedAt) {
              totalPausedMs += Date.now() - pauseStartedAt;
            }
            recordingPaused = false;
            pauseStartedAt = null;
            saveRecordingState();
          }
          sendResponse(res);
        });
      return true;

    case "recording-complete":
      console.log("Recording done → saving");

      sendResponse({ success: true });

      (async () => {
        await saveRecordingMetadata(message.data);
        await clearRecordingState();
        await closeOffscreenDocument();
      })();

      return true;

    case "dashboard-session":
      (async () => {
        try {
          const senderUrl = sender?.url ? new URL(sender.url) : null;
          const senderOrigin = senderUrl?.origin || null;
          if (senderOrigin && /^https?:\/\//.test(senderOrigin)) {
            await chrome.storage.local.set({ dashboardOrigin: senderOrigin });
          }
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error?.message || "Failed to sync dashboard origin" });
        }
      })();
      return true;

    // ✅ Request mic permission via offscreen document
    case "request-mic-permission":
      (async () => {
        try {
          await createOffscreenDocument();
          await new Promise((r) => setTimeout(r, 300));

          const res = await chrome.runtime.sendMessage({
            type: "request-mic-permission",
            target: "offscreen",
          });

          await closeOffscreenDocument();
          sendResponse({ granted: res?.granted || false });
        } catch (err) {
          console.error("Mic permission error:", err);
          sendResponse({ granted: false, error: err.message });
        }
      })();
      return true;

    // ✅ Forward mic-permission-result from offscreen
    case "mic-permission-result":
      // Handled by the awaited sendMessage above
      return;

    default:
      sendResponse({ success: false, error: "Unknown message" });
      return;
  }
});
