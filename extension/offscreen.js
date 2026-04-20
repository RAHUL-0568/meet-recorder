// ============================================================
// Meet Recorder — Offscreen Document
// Handles MediaRecorder, audio mixing (tab + mic), and blob assembly
// ============================================================

let mediaRecorder = null;
let recordedChunks = [];
let tabStream = null;
let micStream = null;
let audioContext = null;
let recordingStartTime = null;
let hasMic = false;
let pauseStartedAt = null;
let totalPausedMs = 0;
let recorderMimeType = 'audio/webm';
let completingRecording = false;
let stopRequested = false;
let discardOnStop = false;

// -----------------------------------------------------------
// Dedicated Port to Background (more reliable than sendMessage)
// -----------------------------------------------------------
const offscreenPort = chrome.runtime.connect({ name: 'meet-recorder-offscreen' });
offscreenPort.onMessage.addListener(async (payload) => {
  const { requestId, message } = payload || {};
  if (!requestId || !message) return;

  try {
    if (message.target !== 'offscreen') {
      offscreenPort.postMessage({ requestId, response: { success: false, error: 'Invalid target' } });
      return;
    }

    let response;
    switch (message.type) {
      case 'start-recording':
        response = await handleStartRecording(message.data);
        break;
      case 'stop-recording':
        response = handleStopRecording();
        break;
      case 'abort-recording':
        response = handleAbortRecording();
        break;
      case 'pause-recording':
        response = handlePauseRecording();
        break;
      case 'resume-recording':
        response = handleResumeRecording();
        break;
      default:
        response = { success: false, error: `Unknown offscreen message type: ${message.type}` };
        break;
    }

    offscreenPort.postMessage({ requestId, response });
  } catch (error) {
    offscreenPort.postMessage({
      requestId,
      response: { success: false, error: error?.message || 'Offscreen handler error' }
    });
  }
});

// -----------------------------------------------------------
// Message Listener
// -----------------------------------------------------------
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.type) {
    case 'start-recording':
      handleStartRecording(message.data)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error?.message || 'Failed to start recording' }));
      return true;

    case 'stop-recording':
      sendResponse(handleStopRecording());
      return true;
    case 'abort-recording':
      sendResponse(handleAbortRecording());
      return true;
    case 'pause-recording':
      sendResponse(handlePauseRecording());
      return true;
    case 'resume-recording':
      sendResponse(handleResumeRecording());
      return true;
  }
});

// -----------------------------------------------------------
// Start Recording
// -----------------------------------------------------------
async function handleStartRecording(data) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    return { success: true, alreadyRecording: true };
  }

  const { streamId, includeMic } = data;

  try {
    completingRecording = false;
    stopRequested = false;
    discardOnStop = false;

    // 1. Capture tab audio using the stream ID
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });
    const tabAudioTracks = tabStream.getAudioTracks();
    if (!tabAudioTracks || tabAudioTracks.length === 0) {
      throw new Error('No tab audio track found. Make sure Meet audio is playing and try again.');
    }

    // 2. Set up AudioContext for mixing
    audioContext = new AudioContext();
    // Offscreen docs can start suspended; resume improves reliability.
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const destination = audioContext.createMediaStreamDestination();

    // 3. Connect tab audio → destination (for recording)
    const tabSource = audioContext.createMediaStreamSource(tabStream);
    tabSource.connect(destination);

    // 4. Also connect tab audio → speakers so user can still hear the meeting
    tabSource.connect(audioContext.destination);

    // 5. Optionally capture and mix microphone
    hasMic = false;
    if (includeMic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        const micSource = audioContext.createMediaStreamSource(micStream);
        // Apply slight gain reduction to mic to avoid overpowering tab audio
        const micGain = audioContext.createGain();
        micGain.gain.value = 0.8;
        micSource.connect(micGain);
        micGain.connect(destination);
        hasMic = true;
      } catch (micError) {
        const micErrorName = micError?.name || 'MicrophoneError';
        const micErrorMessage = micError?.message || 'Microphone permission denied';
        console.warn(
          `Microphone access denied, recording tab audio only: ${micErrorName} - ${micErrorMessage}`
        );
      }
    }

    // 6. Create MediaRecorder with the merged audio stream
    const mergedStream = destination.stream;

    // Choose the best supported MIME type
    const mimeType = getSupportedMimeType();
    recorderMimeType = mimeType;

    mediaRecorder = new MediaRecorder(mergedStream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000
    });

    recordedChunks = [];
    recordingStartTime = Date.now();
    pauseStartedAt = null;
    totalPausedMs = 0;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (!discardOnStop) {
        handleRecordingComplete();
      } else {
        cleanupMediaResources();
        // Reset state without downloading/uploading
        recordedChunks = [];
        mediaRecorder = null;
        recorderMimeType = 'audio/webm';
        recordingStartTime = null;
        pauseStartedAt = null;
        totalPausedMs = 0;
        completingRecording = false;
        stopRequested = false;
        discardOnStop = false;
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      chrome.runtime.sendMessage({
        type: 'recording-error',
        error: event.error?.message || 'MediaRecorder error'
      });
    };

    // Request data every 1 second for more granular chunks
    mediaRecorder.start(1000);

    console.log('Recording started with mimeType:', mimeType);

    // Listen for tab stream ending (user navigated away, etc.)
    tabStream.getAudioTracks().forEach(track => {
      track.onended = () => {
        console.log('Tab audio track ended');
        handleStopRecording();
      };
    });

    return { success: true };
  } catch (error) {
    const errName = error?.name || 'Error';
    const errMessage = error?.message || String(error);
    console.error('Failed to start recording:', errName, errMessage);
    chrome.runtime.sendMessage({
      type: 'recording-error',
      error: `${errName}: ${errMessage}`
    });
    cleanupMediaResources();
    return { success: false, error: `${errName}: ${errMessage}` };
  }
}

// -----------------------------------------------------------
// Stop Recording
// -----------------------------------------------------------
function handleStopRecording() {
  if (stopRequested) {
    return { success: true };
  }
  stopRequested = true;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.requestData();
    } catch {
      // Ignore; some recorder states may reject requestData.
    }
    mediaRecorder.stop();
    return { success: true };
  }
  cleanupMediaResources();
  return { success: true };
}

function handleAbortRecording() {
  discardOnStop = true;
  return handleStopRecording();
}

function handlePauseRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    return { success: false, error: 'Recorder is not active' };
  }
  mediaRecorder.pause();
  pauseStartedAt = Date.now();
  return { success: true };
}

function handleResumeRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') {
    return { success: false, error: 'Recorder is not paused' };
  }
  mediaRecorder.resume();
  if (pauseStartedAt) {
    totalPausedMs += Date.now() - pauseStartedAt;
    pauseStartedAt = null;
  }
  return { success: true };
}

function cleanupMediaResources() {
  // Stop all tracks
  if (tabStream) {
    tabStream.getTracks().forEach(track => track.stop());
    tabStream = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  // Close AudioContext
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
}

// -----------------------------------------------------------
// Handle Recording Complete — Assemble blob and trigger download
// -----------------------------------------------------------
async function handleRecordingComplete() {
  if (completingRecording) {
    return;
  }
  completingRecording = true;

  const mimeType = recorderMimeType || getSupportedMimeType();
  const blob = new Blob(recordedChunks, { type: mimeType });
  const currentPauseMs = pauseStartedAt ? Date.now() - pauseStartedAt : 0;
  const duration = Math.round((Date.now() - recordingStartTime - totalPausedMs - currentPauseMs) / 1000);

  if (!blob.size || recordedChunks.length === 0) {
    chrome.runtime.sendMessage({
      type: 'recording-error',
      error: 'Recording was empty. Please record for at least a few seconds before stopping.'
    });
    recordedChunks = [];
    mediaRecorder = null;
    recorderMimeType = 'audio/webm';
    recordingStartTime = null;
    pauseStartedAt = null;
    totalPausedMs = 0;
    completingRecording = false;
    return;
  }

  // Generate filename
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
  const extension = mimeType.includes('webm') ? 'webm' : 'ogg';
  const filename = `meet-recording-${dateStr}_${timeStr}.${extension}`;

  // Create a download link and trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  // Notify background script
  chrome.runtime.sendMessage({
    type: 'recording-complete',
    data: {
      duration: duration,
      fileSize: blob.size,
      blob: blob,
      mimeType: mimeType,
      filename: filename,
      hasMic: hasMic,
      totalPausedMs: totalPausedMs + currentPauseMs
    }
  });

  setTimeout(() => URL.revokeObjectURL(url), 30000);

  // Clean up
  recordedChunks = [];
  mediaRecorder = null;
  recorderMimeType = 'audio/webm';
  recordingStartTime = null;
  pauseStartedAt = null;
  totalPausedMs = 0;
  completingRecording = false;

  console.log(`Recording complete: ${filename} (${formatBytes(blob.size)}, ${duration}s)`);
}


// -----------------------------------------------------------
// Utilities
// -----------------------------------------------------------
function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'audio/webm'; // fallback
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
