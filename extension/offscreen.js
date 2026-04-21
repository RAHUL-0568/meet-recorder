let mediaRecorder = null;
let recordedChunks = [];
let startTime = null;
let finalStream = null;
let audioContext = null; // ✅ ADD THIS

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return;

  (async () => {
    try {
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

          // ✅ DOWNLOAD
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);

          // ✅ SEND TO BACKGROUND FIRST
          chrome.runtime.sendMessage({
            type: "recording-complete",
            data: {
              filename,
              fileSize: blob.size,
              duration: Math.floor((Date.now() - startTime) / 1000),
              hasMic: micEnabled,
              timestamp: new Date().toISOString(),
            },
          });

          // 🔥 UPLOAD (NON-BLOCKING)
          setTimeout(async () => {
            try {
              const formData = new FormData();
              formData.append("file", blob, filename);
              formData.append("title", "Google Meet Recording");
              formData.append(
                "duration",
                Math.floor((Date.now() - startTime) / 1000),
              );

              await fetch("http://localhost:3000/api/recordings", {
                method: "POST",
                body: formData,
                credentials: "include",
              });

              console.log("✅ Uploaded");
            } catch (err) {
              console.error("❌ Upload failed:", err);
            }
          }, 0);

          // ✅ CLEANUP (FIXED)
          if (finalStream) {
            finalStream.getTracks().forEach((t) => t.stop());
            finalStream = null;
          }

          if (audioContext) {
            audioContext.close(); // ✅ CRITICAL FIX
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
        if (mediaRecorder?.state === "recording") {
          mediaRecorder.pause();
          sendResponse({ success: true });
        }
      }

      // ▶️ RESUME
      if (message.type === "resume-recording") {
        if (mediaRecorder?.state === "paused") {
          mediaRecorder.resume();
          sendResponse({ success: true });
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
