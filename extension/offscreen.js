let mediaRecorder = null;
let recordedChunks = [];
let startTime = null;
let finalStream = null;
let audioContext = null; // ✅ ADD THIS
const DEFAULT_DASHBOARD_ORIGIN = "http://localhost:3000";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return;

  (async () => {
    try {
      // 🎤 MIC PERMISSION REQUEST
      if (message.type === "request-mic-permission") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          sendResponse({ granted: true });
        } catch (err) {
          console.error("Mic permission denied:", err);
          sendResponse({ granted: false, error: err.message });
        }
        return;
      }

      // 🎬 START RECORDING
      if (message.type === "start-recording") {
        // ✅ PREVENT DOUBLE START
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          sendResponse({ success: false, error: "Already recording" });
          return;
        }

        const { streamId, includeMic } = message.data;

        console.log("🎬 Starting recording...");

        const tabStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: streamId,
            },
          },
          video: false,
        });

        audioContext = new AudioContext(); // ✅ FIX
        const destination = audioContext.createMediaStreamDestination();

        const tabSource = audioContext.createMediaStreamSource(tabStream);
        tabSource.connect(destination);
        tabSource.connect(audioContext.destination); // 🔊 Play tab audio to speakers

        let micEnabled = false;

        if (includeMic) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(destination);
          micEnabled = true;
        }

        finalStream = destination.stream;
        recordedChunks = [];

        mediaRecorder = new MediaRecorder(finalStream, {
          mimeType: "audio/webm",
        });

        mediaRecorder.start(1000);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          console.log("🛑 Stopped");

          await new Promise((r) => setTimeout(r, 200));

          const blob = new Blob(recordedChunks, {
            type: "audio/webm",
          });

          const filename = `meet-${Date.now()}.webm`;
          const recDuration = Math.floor((Date.now() - startTime) / 1000);

          // ✅ DOWNLOAD locally
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);

          // ☁️ UPLOAD TO SUPABASE BUCKET FIRST (before signaling complete)
          let uploaded = false;
          try {
            const { dashboardOrigin } = await chrome.storage.local.get("dashboardOrigin");
            const dashboardBaseUrl = dashboardOrigin || DEFAULT_DASHBOARD_ORIGIN;
            const formData = new FormData();
            formData.append("file", blob, filename);
            formData.append("title", "Google Meet Recording");
            formData.append("duration", recDuration);

            const res = await fetch(`${dashboardBaseUrl}/api/recordings`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });

            const result = await res.json();
            uploaded = result.success;
            console.log(uploaded ? "✅ Uploaded to bucket" : "⚠️ Upload response:", result);
          } catch (err) {
            console.error("❌ Upload failed:", err);
          }

          // ✅ SIGNAL BACKGROUND ONLY AFTER UPLOAD FINISHES
          chrome.runtime.sendMessage({
            type: "recording-complete",
            data: {
              filename,
              fileSize: blob.size,
              duration: recDuration,
              hasMic: micEnabled,
              uploaded,
              timestamp: new Date().toISOString(),
            },
          });

          // ✅ CLEANUP
          if (finalStream) {
            finalStream.getTracks().forEach((t) => t.stop());
            finalStream = null;
          }

          if (audioContext) {
            audioContext.close();
            audioContext = null;
          }

          mediaRecorder = null;
          recordedChunks = [];
        };

        startTime = Date.now();

        sendResponse({ success: true });
      }

      // 🛑 STOP
      if (message.type === "stop-recording") {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "No recording active" });
        }
      }

      // ⏸️ PAUSE
      if (message.type === "pause-recording") {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.pause();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "Cannot pause" });
        }
      }

      // ▶️ RESUME
      if (message.type === "resume-recording") {
        if (mediaRecorder && mediaRecorder.state === "paused") {
          mediaRecorder.resume();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "Cannot resume" });
        }
      }
    } catch (error) {
      console.error("❌ Offscreen error:", error);

      chrome.runtime.sendMessage({
        type: "recording-error",
        error: error.message,
      });

      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});
