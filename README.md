# ALTA – Crunchyroll + AniList Extension  
**⚠️ Important: this project is currently being moved (or has already been moved) to a far more advanced extension: [URL].**  
Download it — it completely redesigns **Crunchyroll** (a cleaner, modern UI) and adds **full AniList integration**.  
This new extension is the true evolution of ALTA: more stable, more powerful, and simply better to use.

---

## Overview

ALTA is a Chrome extension designed to automatically sync your Crunchyroll watching progress with AniList.  
It intercepts real-time viewing data, updates your lists instantly, and provides a fast, modern interface to manage your anime progress.

---

## New Features (v1.11+)

### Advanced Crunchyroll Watchlist Sync
- Direct, reliable interception of Crunchyroll’s internal API  
- Accurate progress detection (episode actually watched vs. queued)  
- Incremental syncing with safe rate-limiting (2s between requests)  
- Real-time progress display  
- Smart local caching to reduce redundant requests

---

## Installation

1. Clone or download the project  
2. Open Chrome and go to `chrome://extensions/`  
3. Enable **Developer Mode**  
4. Click **Load unpacked**  
5. Select the project folder

---

## Usage

### Initial Setup
1. Click the ALTA icon  
2. Log into AniList via OAuth  
3. Grant authorization

### Episode-by-Episode Sync
- The extension automatically detects your watching progress  
- Use the +/- buttons in the popup if you need to adjust manually

### Watchlist Sync

#### Automatic Method
1. Go to: https://www.crunchyroll.com/watchlist  
2. Wait for the page to fully load  
3. Open the ALTA popup  
4. Click the sync icon  
5. Data is detected and processed automatically

#### Manual Method
1. Open ALTA  
2. Click the sync icon  
3. Select **Sync Now**  
4. Watch the progress bar update live

---

## Troubleshooting

### “No watchlist data available”
This means no data has been captured from Crunchyroll yet.

**Quick Fix:**  
1. Open: https://www.crunchyroll.com/watchlist  
2. Wait for it to fully load  
3. Refresh the page if needed  
4. Try syncing again

A full troubleshooting guide is available in **DEBUG_WATCHLIST.md**

### Check if Interception Works
```
Open DevTools (F12 → Console) and look for:
ALTA: Fetch interceptor installed successfully
ALTA: Intercepted Watchlist API call: ...
ALTA: Captured watchlist data
```

If these are missing:  
1. Go to `chrome://extensions/`  
2. Locate ALTA  
3. Click **Reload**

---

## Features

- AniList OAuth login  
- Automatic episode detection  
- Manual progress controls (+ / -)  
- Episode release notifications  
- Viewing statistics  
- Full Crunchyroll watchlist sync  
- Smart rate-limiting  
- Crunchyroll ↔ AniList caching system

---

## Configuration

Create a `data.js` file based on `data.js.example`:

```js
const clientData = {
  clientId: "YOUR_ANILIST_CLIENT_ID"
};
```
Get your Client ID here: https://anilist.co/settings/developer

## Project Structure
```
ALTA/
├── manifest.json
├── background.js
├── popup.html/js/css
├── crunchyroll-interceptor.js
├── crunchyroll-content-bridge.js
├── crunchyroll-content.js
├── data.js
└── DEBUG_WATCHLIST.md
```
## License

## Credits
 - AniList (GraphQL API)
 - Crunchyroll (unofficial interception)
 - Font Awesome (icons)
**Author**: JeremGaming
**Version**: 1.11+
**Last Updated**: 2025-11-30
