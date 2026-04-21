# 🎙️ Meet Recorder

Meet Recorder is a Chrome extension + Next.js dashboard for recording Google Meet audio, uploading recordings to Supabase, and reviewing them in a personal dashboard.

## 📦 Project Structure

```text
meet-recorder/
├── extension/   # Chrome extension (Manifest V3)
└── dashboard/   # Next.js dashboard + APIs + auth
```

## ✅ Current Dashboard Flow

- Landing page with **Add to Chrome** download action
- Google OAuth sign-in via NextAuth
- Upload recordings to `POST /api/recordings`
- Recordings list and playback pages
- Delete recording support from dashboard

## 🚀 Local Setup

### 1) Install dashboard dependencies

```bash
cd dashboard
npm install
```

### 2) Configure environment (`dashboard/.env.local`)

```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3) Generate Prisma client and run migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4) Run dashboard

```bash
npm run dev
```

Open: `http://localhost:3000`

> Keep the dashboard on `http://localhost:3000` in local development because the extension is currently wired to that origin in the repository-relative files `extension/manifest.json`, `extension/offscreen.js`, and `extension/popup/popup.js`. If you change the dashboard URL, update all three locations together (simple one-file change is not enough).

## 🧩 Install Chrome Extension

### Option A: from dashboard (recommended)
1. Open `http://localhost:3000`
2. Click **Add to Chrome — It's Free** to download the zip
3. Unzip it locally
4. Go to `chrome://extensions`
5. Enable **Developer mode**
6. Click **Load unpacked** and select the unzipped extension folder

### Option B: direct from repo
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder in the repository root

## 🎬 Usage

1. Sign in on `http://localhost:3000`
2. Open a Google Meet tab
3. Start recording from the extension popup
4. Stop recording when done
5. Recording is downloaded locally and uploaded to dashboard storage
6. Open `/recordings` to review playback

## 🧪 Integration Testing Checklist (Local)

Use this to verify extension ↔ dashboard integration after setup:

1. **Auth bridge:** Sign in on dashboard, open extension popup, ensure it does not ask you to log in again
2. **Record upload:** Start and stop a short recording from Google Meet
3. **API success:** Confirm `POST /api/recordings` returns success in dashboard logs/network
4. **Dashboard list:** Confirm new recording appears on `/recordings`
5. **Playback page:** Open the recording and verify audio playback works
6. **Delete flow:** Delete recording and verify it disappears from the list

## ⚠️ Notes

- Extension is intended for developer-mode local usage right now
- Dashboard and extension host permissions are currently configured for `localhost:3000`
- Microphone permission is required when recording with mic enabled
