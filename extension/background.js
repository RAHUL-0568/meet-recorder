// background.js - Chrome Extension Service Worker
// Handles Google Meet recording, state management, and dashboard integration

// -----------------------------------------------------------
// Constants
// -----------------------------------------------------------
const DASHBOARD_URL = 'http://localhost:3000';
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// -----------------------------------------------------------
// State Variables
// -----------------------------------------------------------
let recording = false;
let recordingTabId = null;
let recordingStartTime = null;
let recordingPaused = false;
let pauseStartedAt = null;
let totalPausedMs = 0;

// -----------------------------------------------------------
// Offscreen Document Management
// -----------------------------------------------------------
async function createOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN']
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['AUDIO_CAPTURE', 'USER_MEDIA'],
    justification: 'Recording audio from Google Meet tabs'
  });
}

async function closeOffscreenDocument() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN']
    });

    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.log('Offscreen document close error:', error);
  }
}

async function sendOffscreenMessageWithRetry(message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response?.success) {
        return response;
      }
      if (response?.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// -----------------------------------------------------------
// Recording Functions
// -----------------------------------------------------------
async function startRecording(tab, includeMic = false) {
  if (recording) {
    return { success: false, error: 'Recording already in progress' };
  }

  try {
    // First, capture the tab to get a stream ID
    const streamId = await captureTabAudio(tab.id);

    // Create offscreen document for recording
    await createOffscreenDocument();

    // Wait for offscreen document to initialize
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send start recording command to offscreen with the stream ID
    const response = await sendOffscreenMessageWithRetry({
      type: 'start-recording',
      target: 'offscreen',
      data: {
        streamId: streamId,
        includeMic: includeMic
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to start recording');
    }

    // Update state
    recording = true;
    recordingTabId = tab.id;
    recordingStartTime = Date.now();
    recordingPaused = false;
    pauseStartedAt = null;
    totalPausedMs = 0;

    // Persist state
    await chrome.storage.local.set({
      recording: true,
      recordingTabId: tab.id,
      recordingStartTime: recordingStartTime,
      recordingPaused: false,
      pauseStartedAt: null,
      totalPausedMs: 0
    });

    // Update badge
    chrome.action.setBadgeText({ text: 'REC' };
    chrome.action.setBadgeBackgroundColor{ color: '#EF4444' };

    return { success: true };
  } catch (error) {
    console.error('Start recording error:', error);
    await resetRecordingState(false);
    return { success: false, error: error.message };
  }
}

// Capture tab audio and return the stream ID
async function captureTabAudio(tabId) {
  return new Promise((resolve, reject) => {
    // Get the stream from tab capture
    chrome.tabCapture.capture({
      audio: true,
      video: false,
      audioConstraints: {
        mandatory: {
          chromeMediaSource: 'tab',
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      }
    }, (stream) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!stream) {
        reject(new Error('No stream returned from tab capture'));
        return;
      }

      // Get the stream ID - this is what we pass to the offscreen
      const streamId = stream.id;
      resolve(streamId);
    });
  });
}

async function stopRecording() {
  if (!recording) {
    return { success: false, error: 'No recording in progress' };
  }

  try {
    const response = await sendOffscreenMessageWithRetry({
      type: 'stop-recording',
      target: 'offscreen'
    });

    if (!response.success && response.error !== 'No recording active') {
      throw new Error(response.error);
    }

    await resetRecordingState(true);
    return { success: true };
  } catch (error) {
    await resetRecordingState(false);
    return { success: false, error: error.message };
  }
}

async function resetRecordingState(clearBadge = true) {
  recording = false;
  recordingTabId = null;
  recordingStartTime = null;
  recordingPaused = false;
  pauseStartedAt = null;
  totalPausedMs = 0;

  await chrome.storage.local.set({
    recording: false,
    recordingTabId: null,
    recordingStartTime: null,
    recordingPaused: false,
    pauseStartedAt: null,
    totalPausedMs: 0
  });

  if (clearBadge) {
    chrome.action.setBadgeText{ text: '' };
  }
}

async function pauseRecording() {
  if (!recording || recordingPaused) {
    return { success: false, error: 'Recording is not active or already paused' };
  }

  try {
    await sendOffscreenMessageWithRetry({
      type: 'pause-recording',
      target: 'offscreen'
    });

    recordingPaused = true;
    pauseStartedAt = Date.now();

    await chrome.storage.local.set({
      recordingPaused: true,
      pauseStartedAt,
      totalPausedMs
    });

    chrome.action.setBadgeText{ text: 'PAUSE' };
    chrome.action.setBadgeBackgroundColor{ color: '#F59E0B' };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function resumeRecording() {
  if (!recording || !recordingPaused) {
    return { success: false, error: 'Recording is not paused' };
  }

  try {
    await sendOffscreenMessageWithRetry({
      type: 'resume-recording',
      target: 'offscreen'
    });

    const now = Date.now();
    if (pauseStartedAt) {
      totalPausedMs += (now - pauseStartedAt);
    }
    recordingPaused = false;
    pauseStartedAt = null;

    await chrome.storage.local.set({
      recordingPaused: false,
      pauseStartedAt: null,
      totalPausedMs
    });

    chrome.action.setBadgeText{ text: 'REC' };
    chrome.action.setBadgeBackgroundColor{ color: '#EF4444' };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// -----------------------------------------------------------
// Message Handling
// -----------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages meant for offscreen document
  if (message.target === 'offscreen') return;

  switch (message.type) {

    case 'ping': {
      sendResponse({ success: true });
      return true;
    }

    case 'meeting-info': {
      const{ meetingCode, title, url } = message.data || {};
      chrome.storage.local.set({
        lastMeetingCode: meetingCode || null,
        lastMeetingTitle: title || null,
        lastMeetingUrl: url || null,
        lastMeetingSeenAt: new Date().toISOString()
      });
      sendResponse({ success: true });
      return true;
    }

    case 'start-recording': {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        try {
          if (!tabs || tabs.length === 0) {
            sendResponse({ success: false, error: 'No active tab found' });
            return;
          }
          const result = await startRecording(tabs[0], message.includeMic);
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            error: error?.message || 'Unexpected background error while starting'
          });
        }
      });
      return true;
    }

    case 'stop-recording': {
      stopRecording().then(result => sendResponse(result)).catch(err => {
        sendResponse({ success: false, error: err?.message || 'Failed to stop' });
      });
      return true;
    }

    case 'pause-recording': {
      pauseRecording().then(result => sendResponse(result)).catch(err => {
        sendResponse{ success: false, error: err?.message || 'Failed to pause' });
      });
      return true;
    }

    case 'resume-recording': {
      resumeRecording().then(result => sendResponse(result)).catch(err => {
        sendResponse{ success: false, error: err?.message || 'Failed to resume' };
      });
      return true;
    }

    case 'get-status': {
      sendResponse({
        recording,
        recordingTabId,
        recordingStartTime,
        recordingPaused,
        pauseStartedAt,
        totalPausedMs
      });
      return true;
    }

    case 'recording-complete': {
      // Recording blob is ready — offscreen document has saved it locally.
      // Close the offscreen document after a brief delay.
      setTimeout(() => closeOffscreenDocument(), 1000);

      handleRecordingComplete(message.data)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({
          success: false,
          error: error?.message || 'Failed to process recording'
        }));
      return true;
    }

    case 'recording-error': {
      console.error('Recording error from offscreen:', message.error);
      resetRecordingState(false).catch(() => {});
      chrome.action.setBadgeText{ text: 'ERR' };
      chrome.action.setBadgeBackgroundColor{ color: '#F59E0B' };
      setTimeout(() => chrome.action.setBadgeText{ text: '' }), 3000);
      sendResponse({ success: true });
      return true;
    }

    case 'dashboard-session': {
      // When dashboard page loads, it sends session info to link the extension
      const userId = message.data?.userId || null;
      const userEmail = message.data?.email || null;
      chrome.storage.local.set({
        dashboardUserId: userId,
        dashboardUserEmail: userEmail,
        dashboardSessionSeenAt: new Date().toISOString()
      });
      console.log('Dashboard session linked:', userId, userEmail);
      sendResponse({ success: true });
      return true;
    }

    case 'check-dashboard-link': {
      // Check if extension is linked to dashboard
      chrome.storage.local.get(['dashboardUserId', 'dashboardUserEmail'], (result) => {
        sendResponse({
          linked: !!result.dashboardUserId,
          userId: result.dashboardUserId,
          email: result.dashboardUserEmail
        });
      });
      return true;
    }
  }
});

// -----------------------------------------------------------
// Handle recording completion (local metadata + dashboard upload)
// -----------------------------------------------------------
async function handleRecordingComplete(data) {
  // Always save recording locally first
  await saveRecordingMetadata({
    ...data,
    uploaded: false,
    uploadError: null,
    dashboardRecordingId: null
  });

  // Try to upload to dashboard (best effort - doesn't block local save)
  if (data?.blob) {
    const uploadResult = await uploadRecordingToDashboard(data);

    // Update metadata with upload result
    const stored = await chrome.storage.local.get('recordings');
    if (stored.recordings && stored.recordings.length > 0) {
      stored.recordings[0].uploaded = uploadResult.success;
      stored.recordings[0].uploadError = uploadResult.error || null;
      stored.recordings[0].dashboardRecordingId = uploadResult.recordingId || null;
      await chrome.storage.local.set({ recordings: stored.recordings });
    }
  }
}

// -----------------------------------------------------------
// Upload recording to dashboard API (best effort)
// -----------------------------------------------------------
async function uploadRecordingToDashboard(data) {
  if (!data?.blob) {
    return { success: false, error: 'No blob available for upload' };
  }

  try {
    const blob = data.blob;

    // Get meeting info
    const meeting = await chrome.storage.local.get(['meetingTitle', 'meetingUrl', 'lastMeetingTitle', 'lastMeetingUrl']);
    const meetingTitle = meeting.meetingTitle || meeting.lastMeetingTitle || 'Google Meet Recording';
    const meetingUrl = meeting.meetingUrl || meeting.lastMeetingUrl;

    // Get linked dashboard user ID
    const extensionUserId = await getLinkedDashboardUserId();
    const meetingCode = extractMeetingCode(meetingUrl);

    if (!extensionUserId) {
      console.log('No linked dashboard user - recording saved locally only');
      return { success: false, error: 'Sign in to dashboard and open it once to link extension.' };
    }

    const formData = new FormData();
    formData.append('file', blob, data.filename || `meet-recording-${Date.now()}.webm`);
    formData.append('title', meetingTitle);
    formData.append('duration', String(data.duration || 0));
    formData.append('extensionUserId', extensionUserId);
    if (meetingCode) {
      formData.append('meetingCode', meetingCode);
    }

    // Use correct API endpoint
    const response = await fetch(`${DASHBOARD_URL}/api/recordings`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const payload = await response.text();
      return { success: false, error: `Upload failed (${response.status}): ${payload}` };
    }

    const payload = await response.json();
    console.log('Recording uploaded successfully:', payload);
    return { success: true, recordingId: payload?.recording?.id || null };
  } catch (error) {
    console.error('Dashboard upload error:', error);
    return { success: false, error: error?.message || 'Dashboard upload failed' };
  }
}

async function getLinkedDashboardUserId() {
  // First check if we already have a linked user from dashboard
  const existing = await chrome.storage.local.get(['dashboardUserId']);
  if (existing.dashboardUserId) {
    return existing.dashboardUserId;
  }

  // Try to get session from dashboard - this may fail due to CORS
  // but we try anyway as a fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${DASHBOARD_URL}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const session = await response.json();
    const userId = session?.user?.id || null;
    const email = session?.user?.email || null;
    if (!userId) return null;

    // Store for future use
    await chrome.storage.local.set({
      dashboardUserId: userId,
      dashboardUserEmail: email,
      dashboardSessionSeenAt: new Date().toISOString()
    });
    return userId;
  } catch (error) {
    console.log('Could not fetch dashboard session:', error.message);
    return null;
  }
}

function extractMeetingCode(meetingUrl) {
  if (!meetingUrl) return null;
  try {
    const url = new URL(meetingUrl);
    if (!url.hostname.includes('meet.google.com')) return null;
    return url.pathname.replace('/', '') || null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------
// Save Recording Metadata
// -----------------------------------------------------------
async function saveRecordingMetadata(data) {
  const stored = await chrome.storage.local.get('recordings');
  const recordings = stored.recordings || [];

  const meeting = await chrome.storage.local.get(['meetingUrl', 'meetingTitle', 'lastMeetingUrl', 'lastMeetingTitle']);
  const title = meeting.meetingTitle || meeting.lastMeetingTitle || 'Google Meet Recording';
  const url = meeting.meetingUrl || meeting.lastMeetingUrl || '';

  recordings.unshift({
    id: Date.now().toString(),
    title: title,
    meetingUrl: url,
    duration: data.duration || 0,
    fileSize: data.fileSize || 0,
    filename: data.filename || '',
    timestamp: new Date().toISOString(),
    hasAudio: true,
    hasMic: data.hasMic || false,
    uploaded: Boolean(data.uploaded),
    uploadError: data.uploadError || null,
    dashboardRecordingId: data.dashboardRecordingId || null
  });

  // Keep last 50 recordings in metadata
  if (recordings.length > 50) recordings.length = 50;

  await chrome.storage.local.set({ recordings };
}

// -----------------------------------------------------------
// Tab Close Detection (auto-stop recording)
// -----------------------------------------------------------
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === recordingTabId && recording) {
    console.log('Recording tab closed, stopping recording...');
    stopRecording();
  }
});

// -----------------------------------------------------------
// Extension Install / Update
// -----------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    recording: false,
    recordings: [],
    recordingTabId: null,
    recordingStartTime: null,
    recordingPaused: false,
    pauseStartedAt: null,
    totalPausedMs: 0,
    dashboardUserId: null,
    dashboardUserEmail: null,
    lastMeetingCode: null,
    lastMeetingTitle: null,
    lastMeetingUrl: null
  });
});