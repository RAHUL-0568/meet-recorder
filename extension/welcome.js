// welcome.js — Grant microphone permission on install

const grantBtn = document.getElementById("grantBtn");
const micStatus = document.getElementById("micStatus");
const permMic = document.getElementById("permMic");

function setGranted() {
  micStatus.textContent = "Granted";
  micStatus.className = "perm-status granted";
  permMic.classList.add("granted");
  grantBtn.innerHTML = "✓ All Set — You can close this tab";
  grantBtn.classList.add("done");
  grantBtn.disabled = false;
  grantBtn.onclick = () => window.close();
}

function setDenied(msg) {
  grantBtn.disabled = false;
  grantBtn.innerHTML = msg || "Permission Denied — Click to Retry";
  micStatus.textContent = "Denied";
  micStatus.className = "perm-status pending";
}

// Try direct getUserMedia first (works on some Chrome versions for extension pages)
async function tryDirectMic() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

// Fallback: open a helper popup window that requests mic permission
function tryPopupMic() {
  return new Promise((resolve) => {
    // Create a small data-url page that requests mic
    const helperHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Mic Permission</title></head>
      <body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <p id="msg">Requesting microphone access...</p>
        <script>
          (async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(t => t.stop());
              document.getElementById('msg').textContent = 'Granted! This window will close...';
              window.opener.postMessage({ micGranted: true }, '*');
              setTimeout(() => window.close(), 1000);
            } catch(e) {
              document.getElementById('msg').textContent = 'Denied. Please allow microphone access.';
              window.opener.postMessage({ micGranted: false }, '*');
            }
          })();
        <\/script>
      </body>
      </html>
    `;

    const blob = new Blob([helperHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const popup = window.open(url, "mic_permission", "width=420,height=250,left=300,top=300");

    // Listen for response from the popup
    const handler = (event) => {
      if (event.data && typeof event.data.micGranted === "boolean") {
        window.removeEventListener("message", handler);
        resolve(event.data.micGranted);
        if (popup && !popup.closed) {
          popup.close();
        }
        URL.revokeObjectURL(url);
      }
    };

    window.addEventListener("message", handler);

    // Timeout fallback if popup is blocked or closed
    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handler);
        resolve(false);
        URL.revokeObjectURL(url);
      }
    }, 500);

    // Overall timeout
    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener("message", handler);
      if (popup && !popup.closed) popup.close();
      resolve(false);
      URL.revokeObjectURL(url);
    }, 30000);
  });
}

grantBtn.addEventListener("click", async () => {
  grantBtn.disabled = true;
  grantBtn.innerHTML = "Requesting...";

  // Method 1: Try direct getUserMedia on extension page
  const direct = await tryDirectMic();
  if (direct) {
    setGranted();
    return;
  }

  // Method 2: Open a popup window to request mic permission
  const popup = await tryPopupMic();
  if (popup) {
    setGranted();
    return;
  }

  setDenied("Click to Retry — Allow the popup when prompted");
});
