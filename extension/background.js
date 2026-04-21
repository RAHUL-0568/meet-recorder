// background.js (FINAL CLEAN VERSION)

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

let recording = false;
let recordingTabId = null;

// -------------------- INIT --------------------
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["recordings"]);

  if (!existing.recordings) {
    await chrome.storage.local.set({ recordings: [] });
  }
});

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

    recording = false;
    recordingTabId = null;

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

    case "start-recording":
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const res = await startRecording(tabs[0], Boolean(message.includeMic));
        sendResponse(res);
      });
      return true;

    case "stop-recording":
      stopRecording().then(sendResponse);
      return true;

    case "recording-complete":
      console.log("Recording done → saving");

      // respond immediately (IMPORTANT)
      sendResponse({ success: true });

      (async () => {
        await saveRecordingMetadata(message.data);
        await closeOffscreenDocument();
      })();

      return true;

    default:
      sendResponse({ success: false, error: "Unknown message" });
      return;
  }
});
