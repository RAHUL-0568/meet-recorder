# 🎙️ Meet Recorder - Chrome Extension

Record your Google Meet sessions with ease. Captures tab audio and microphone, then syncs recordings to your personal dashboard.

## 🚀 How to Install (Free)

### Step 1: Download
- Click the green **"Code"** button above → **"Download ZIP"**
- Or clone the repo: `git clone https://github.com/YOUR_USERNAME/meet-recorder.git`

### Step 2: Install the Extension
1. Unzip the downloaded file
2. Open **Google Chrome**
3. Go to `chrome://extensions` in the address bar
4. Enable **Developer Mode** (toggle in the top-right corner)
5. Click **"Load unpacked"**
6. Select the `extension` folder from the unzipped files
7. ✅ The Meet Recorder icon will appear in your toolbar!

### Step 3: Pin the Extension
- Click the **puzzle piece** icon in Chrome's toolbar
- Click the **pin** icon next to "Meet Recorder"

## 🎬 How to Use
1. Join a Google Meet call
2. Click the Meet Recorder extension icon
3. Click **Record** to start recording
4. Click **Stop** when you're done
5. Your recording will be saved and synced to the dashboard

## 📊 Dashboard
The dashboard website is live, so you can use it directly to view, play, and manage your recordings.

## ⚠️ Notes
- This extension works in **Developer Mode** only (not from Chrome Web Store)
- Chrome may show a warning about developer mode extensions — this is normal and safe
- The extension requires microphone permission to record audio

## 📁 Project Structure
```
chromomo/
├── extension/          # Chrome extension files
│   ├── manifest.json   # Extension configuration
│   ├── background.js   # Service worker
│   ├── offscreen.js    # Audio recording engine
│   ├── popup/          # Extension popup UI
│   └── icons/          # Extension icons
└── dashboard/          # Next.js web dashboard
```

## 🛠️ Built With
- Chrome Extensions API (Manifest V3)
- MediaRecorder API
- Next.js Dashboard
- Supabase (Auth + Storage)
