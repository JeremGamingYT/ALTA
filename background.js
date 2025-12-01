// ALTA - Background Service Worker
// Handles notifications, alarms, and background tasks

const SERVICE_URL = "https://graphql.anilist.co";

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('ALTA Extension installed/updated', details);

    // Initialize storage if needed
    chrome.storage.local.get(['settings'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    notificationsEnabled: true,
                    autoSync: true
                }
            });
        }
    });
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.action === 'updateAnime') {
        // Handle anime update from Crunchyroll
        handleAnimeUpdate(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }

    if (request.action === 'checkNextAiring') {
        // Check for next airing episodes
        checkNextAiringEpisodes()
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === 'showNotification') {
        // Show a notification
        showNotification(request.title, request.message, request.iconUrl);
        sendResponse({ success: true });
    }

    // NEW: Handle watchlist data from interceptor
    if (request.action === 'WATCHLIST_SYNC') {
        console.log('ALTA: Received watchlist data, processing...');
        handleWatchlistSync(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // NEW: Manual sync trigger from popup
    if (request.action === 'START_WATCHLIST_SYNC') {
        console.log('ALTA: Manual sync triggered');
        startWatchlistSync()
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // NEW: Get sync status
    if (request.action === 'GET_SYNC_STATUS') {
        getSyncStatus()
            .then(status => sendResponse({ success: true, data: status }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // NEW: Get watchlist items
    if (request.action === 'GET_WATCHLIST_ITEMS') {
        getWatchlistItems()
            .then(items => sendResponse({ success: true, data: items }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // NEW: Fetch Crunchyroll watchlist directly from API
    if (request.action === 'FETCH_CRUNCHYROLL_WATCHLIST') {
        fetchCrunchyrollWatchlist()
            .then(data => sendResponse({ success: true, data: data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// ========================================
// CRUNCHYROLL API HEADER CAPTURE
// ========================================

// Capture Crunchyroll auth headers from requests
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Only capture headers from Crunchyroll API calls
        if (details.url.includes('www.crunchyroll.com/content/v2')) {
            console.log('ALTA: Capturing Crunchyroll API headers from:', details.url);

            const headers = {};
            details.requestHeaders.forEach(header => {
                const name = header.name.toLowerCase();
                // Capture auth headers
                if (name === 'authorization' ||
                    name.startsWith('x-crunchyroll')) {
                    headers[header.name] = header.value;
                    console.log(`  → ${header.name}: ${header.value.substring(0, 50)}...`);
                }
            });

            // Store headers for reuse
            if (Object.keys(headers).length > 0) {
                chrome.storage.local.set({ crunchyroll_headers: headers }, () => {
                    console.log('✅ ALTA: Crunchyroll headers stored:', Object.keys(headers));
                });
            }
        }

        return { requestHeaders: details.requestHeaders };
    },
    { urls: ["https://www.crunchyroll.com/*"] },
    ["requestHeaders"]
);

// Handle alarm events for periodic checks
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);

    if (alarm.name === 'checkNextAiring') {
        checkNextAiringEpisodes();
    }
});

// Set up periodic alarm for checking next airing episodes (every hour)
chrome.alarms.create('checkNextAiring', {
    periodInMinutes: 60
});

// Helper for API options
function getOptions(query, variables, token) {
    return {
        method: 'POST',
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ query, variables })
    };
}

// ... existing code ...

const DB_NAME = 'alta-storage';
const DB_VERSION = 6; // Matches popup.js (5 + 1)
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            // We assume popup.js handles upgrades, but we should be safe
            const db = event.target.result;
            if (!db.objectStoreNames.contains('animeList')) {
                db.createObjectStore('animeList', { keyPath: 'id' });
            }
        };
    });
}

// Initialize DB on start
initDB().then(() => console.log('Background: IndexedDB initialized')).catch(console.error);

async function saveMediaToIndexedDB(mediaData) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction('animeList', 'readwrite');
        const store = transaction.objectStore('animeList');

        // We need to match the structure expected by popup.js
        // Enriched data structure
        const enrichedData = {
            id: mediaData.id,
            mediaId: mediaData.mediaId,
            progress: mediaData.progress,
            status: mediaData.status,
            score: mediaData.score,
            media: mediaData.media,
            lastUpdated: Date.now()
        };

        const request = store.put(enrichedData);
        request.onsuccess = () => resolve(enrichedData);
        request.onerror = () => reject(request.error);
    });
}

async function fetchAndSaveAnime(mediaId, token) {
    const query = `
    query($mediaId:Int){
      MediaList(mediaId:$mediaId) {
        id
        mediaId
        progress
        status
        score
        media {
          episodes
          status
          title {
            english
            native
          }
          coverImage {
            medium
            large
            extraLarge
          }
          bannerImage
          format
          season
          seasonYear
          genres
          averageScore
          popularity
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
        }
      }
    }
  `;

    const res = await fetch(SERVICE_URL, getOptions(query, { mediaId }, token));
    const json = await res.json();

    if (json.data && json.data.MediaList) {
        await saveMediaToIndexedDB(json.data.MediaList);
        return json.data.MediaList;
    }
    return null;
}

/**
 * Handle anime update from Crunchyroll content script
 */
async function handleAnimeUpdate(data) {
    try {
        const result = await chrome.storage.local.get(['token', 'userId']);
        if (!result.token) throw new Error('Not authenticated');

        let mediaId = data.mediaId;

        if (!mediaId && data.title) {
            const searchQuery = `
        query($search: String) {
          Media(search: $search, type: ANIME) {
            id
            title {
              english
              romaji
            }
          }
        }
      `;
            const searchRes = await fetch(SERVICE_URL, getOptions(searchQuery, { search: data.title }, result.token));
            const searchJson = await searchRes.json();

            if (searchJson.data && searchJson.data.Media) {
                mediaId = searchJson.data.Media.id;
            } else {
                throw new Error(`Could not find anime: ${data.title}`);
            }
        }

        if (!mediaId) throw new Error('No mediaId provided');

        // 2. Update progress
        const mutation = `
      mutation($mediaId: Int, $progress: Int) {
        SaveMediaListEntry(mediaId: $mediaId, progress: $progress) {
          id
          progress
          status
        }
      }
    `;

        const variables = {
            mediaId: mediaId,
            progress: data.episodeNumber
        };

        const res = await fetch(SERVICE_URL, getOptions(mutation, variables, result.token));
        const json = await res.json();

        if (json.errors) {
            console.error('AniList API Errors:', json.errors);
            throw new Error(json.errors[0].message);
        }

        console.log('Successfully updated progress:', json.data.SaveMediaListEntry);

        // 3. Update Local IndexedDB
        await fetchAndSaveAnime(mediaId, result.token);

        // 4. Broadcast Refresh
        chrome.runtime.sendMessage({ action: 'REFRESH_UI' });

        // Show notification if enabled
        chrome.storage.local.get(['settings'], (settingsRes) => {
            if (settingsRes.settings && settingsRes.settings.notificationsEnabled) {
                showNotification(
                    'ALTA Sync',
                    `Updated progress to Episode ${data.episodeNumber}`
                );
            }
        });

        return json.data.SaveMediaListEntry;

    } catch (error) {
        console.error('Error handling anime update:', error);
        throw error;
    }
}


/**
 * Check for next airing episodes
 */
async function checkNextAiringEpisodes() {
    try {
        const result = await chrome.storage.local.get(['token', 'userId']);

        if (!result.token || !result.userId) {
            return;
        }

        console.log('Checking next airing episodes...');

        const query = `
      query($userId: Int) {
        Page(perPage: 50) {
          mediaList(userId: $userId, type: ANIME, status: CURRENT) {
            media {
              id
              title {
                english
                romaji
              }
              nextAiringEpisode {
                episode
                timeUntilAiring
              }
              coverImage {
                medium
              }
            }
          }
        }
      }
    `;

        const res = await fetch(SERVICE_URL, getOptions(query, { userId: result.userId }, result.token));
        const json = await res.json();

        if (json.data && json.data.Page && json.data.Page.mediaList) {
            const list = json.data.Page.mediaList;

            // Check for episodes airing soon (e.g., in the next hour)
            // Or just notify if a new episode just aired? 
            // The logic here depends on what "notify for next episodes" means.
            // Usually it means "notify when it airs".
            // Since this runs every hour, we can check if timeUntilAiring is < 3600 (1 hour).

            for (const item of list) {
                const next = item.media.nextAiringEpisode;
                if (next && next.timeUntilAiring < 3600 && next.timeUntilAiring > 0) {
                    // Check if we already notified for this episode
                    const notifKey = `notif_${item.media.id}_${next.episode}`;
                    const notifCheck = await chrome.storage.local.get([notifKey]);

                    if (!notifCheck[notifKey]) {
                        const title = item.media.title.english || item.media.title.romaji;
                        showNotification(
                            'New Episode Coming Soon!',
                            `${title} Episode ${next.episode} airs in ${Math.ceil(next.timeUntilAiring / 60)} minutes!`,
                            item.media.coverImage.medium
                        );

                        // Mark as notified
                        chrome.storage.local.set({ [notifKey]: true });
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error checking next airing:', error);
    }
}

/**
 * Show a browser notification
 */
function showNotification(title, message, iconUrl = 'images/icon-64.png') {
    // Ensure iconUrl is valid, otherwise fallback
    if (!iconUrl || iconUrl.startsWith('http')) {
        // Chrome notifications might require local icons or specific https handling
        // For simplicity, let's use the local icon if the remote one fails or is complex to handle
        // But chrome.notifications supports URLs.
    }

    chrome.notifications.create({
        type: 'basic',
        iconUrl: iconUrl || 'images/icon-64.png',
        title: title,
        message: message,
        priority: 2
    });
}

// ========================================
// WATCHLIST SYNC SYSTEM
// ========================================

/**
 * Sync Queue for rate-limited AniList updates
 */
class SyncQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.rateLimit = 2000; // 2 seconds between requests
        this.currentIndex = 0;
        this.totalItems = 0;
    }

    async add(items) {
        this.queue = items;
        this.totalItems = items.length;
        this.currentIndex = 0;

        if (!this.isProcessing) {
            await this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        console.log(`ALTA: Starting sync queue with ${this.queue.length} items`);

        while (this.currentIndex < this.queue.length) {
            const item = this.queue[this.currentIndex];

            try {
                // Update sync status
                await this.updateSyncStatus('syncing', this.currentIndex, this.totalItems);

                // Sync to AniList
                await this.syncToAniList(item);

                // Mark as synced
                item.sync_status = 'synced';
                item.last_synced = Date.now();

                console.log(`ALTA: Synced ${item.series_title} - Episode ${item.last_episode_watched}`);

            } catch (error) {
                console.error(`ALTA: Failed to sync ${item.series_title}:`, error);
                item.sync_status = 'error';
                item.sync_error = error.message;
            }

            // Update storage
            await this.saveWatchlistItem(item);

            this.currentIndex++;

            // Rate limiting
            if (this.currentIndex < this.queue.length) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimit));
            }
        }

        console.log('ALTA: Sync queue completed');
        await this.updateSyncStatus('completed', this.totalItems, this.totalItems);
        this.isProcessing = false;
    }

    async syncToAniList(item) {
        const result = await chrome.storage.local.get(['token']);
        if (!result.token) throw new Error('Not authenticated');

        // If no AniList ID, search for it
        if (!item.anilist_id) {
            const anilistId = await searchAniListByTitle(item.series_title, result.token);
            if (!anilistId) {
                throw new Error('Could not find on AniList');
            }
            item.anilist_id = anilistId;
            await saveCrunchyrollAnilistMapping(item.series_id, anilistId);
        }

        // Update progress on AniList
        const mutation = `
            mutation($mediaId: Int, $progress: Int) {
                SaveMediaListEntry(mediaId: $mediaId, progress: $progress) {
                    id
                    progress
                    status
                }
            }
        `;

        const variables = {
            mediaId: item.anilist_id,
            progress: item.last_episode_watched
        };

        const res = await fetch(SERVICE_URL, getOptions(mutation, variables, result.token));
        const json = await res.json();

        if (json.errors) {
            throw new Error(json.errors[0].message);
        }

        return json.data.SaveMediaListEntry;
    }

    async saveWatchlistItem(item) {
        const result = await chrome.storage.local.get(['crunchyroll_watchlist']);
        const watchlist = result.crunchyroll_watchlist || { items: [] };

        const index = watchlist.items.findIndex(i => i.series_id === item.series_id);
        if (index >= 0) {
            watchlist.items[index] = item;
        } else {
            watchlist.items.push(item);
        }

        await chrome.storage.local.set({ crunchyroll_watchlist: watchlist });
    }

    async updateSyncStatus(status, current, total) {
        await chrome.storage.local.set({
            sync_status: {
                status: status,
                current: current,
                total: total,
                timestamp: Date.now()
            }
        });

        // Notify popup to update UI
        chrome.runtime.sendMessage({
            action: 'SYNC_PROGRESS_UPDATE',
            data: { status, current, total }
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    }
}

const syncQueue = new SyncQueue();

/**
 * Handle watchlist data from interceptor
 */
async function handleWatchlistSync(rawData) {
    console.log(`ALTA: Processing watchlist with ${rawData.total} items`);

    // Parse and store the raw data
    const parsedItems = parseWatchlistData(rawData);

    // Store in localStorage
    await chrome.storage.local.set({
        crunchyroll_watchlist: {
            lastUpdated: Date.now(),
            total: rawData.total,
            items: parsedItems
        }
    });

    console.log(`ALTA: Stored ${parsedItems.length} watchlist items`);

    // Auto-sync if enabled
    const settings = await chrome.storage.local.get(['settings']);
    if (settings.settings?.autoSync) {
        await startWatchlistSync();
    }

    return { stored: parsedItems.length };
}

/**
 * Parse watchlist JSON data
 */
function parseWatchlistData(rawData) {
    if (!rawData.data || !Array.isArray(rawData.data)) {
        console.warn('ALTA: Invalid watchlist data structure');
        return [];
    }

    return rawData.data.map(entry => {
        const panel = entry.panel;
        const metadata = panel.episode_metadata;

        // Calculate progress
        const lastEpisodeWatched = calculateProgress(entry);

        return {
            series_id: metadata.series_id,
            series_title: metadata.series_title,
            season_number: metadata.season_number,
            season_title: metadata.season_title,
            episode_number: metadata.episode_number,
            sequence_number: metadata.sequence_number,
            fully_watched: entry.fully_watched,
            never_watched: entry.never_watched,
            playhead: entry.playhead,
            last_episode_watched: lastEpisodeWatched,
            episode_title: panel.title,
            thumbnail: panel.images?.thumbnail?.[0]?.[0]?.source || '',
            anilist_id: null,
            sync_status: 'pending',
            sync_error: null,
            last_synced: null
        };
    }).filter(item => item.last_episode_watched > 0); // Only sync items with progress
}

/**
 * Calculate the last episode watched based on Crunchyroll data
 */
function calculateProgress(item) {
    const sequenceNumber = item.panel.episode_metadata.sequence_number;

    // Never watched → 0
    if (item.never_watched) {
        return 0;
    }

    // Fully watched → this episode is done
    if (item.fully_watched) {
        return sequenceNumber;
    }

    // Playhead > 0 means started watching this episode
    // But not finished, so last completed is sequenceNumber - 1
    if (item.playhead > 0) {
        return sequenceNumber - 1;
    }

    // Episode listed but not started → previous episode watched
    return sequenceNumber - 1;
}

/**
 * Search AniList by title
 */
async function searchAniListByTitle(title, token) {
    // Check cache first
    const cache = await chrome.storage.local.get(['anilist_search_cache']);
    const searchCache = cache.anilist_search_cache || {};

    if (searchCache[title]) {
        console.log(`ALTA: Using cached AniList ID for "${title}"`);
        return searchCache[title];
    }

    const query = `
        query($search: String) {
            Media(search: $search, type: ANIME) {
                id
                title {
                    romaji
                    english
                    native
                }
            }
        }
    `;

    const res = await fetch(SERVICE_URL, getOptions(query, { search: title }, token));
    const json = await res.json();

    if (json.data?.Media) {
        const anilistId = json.data.Media.id;

        // Cache the result
        searchCache[title] = anilistId;
        await chrome.storage.local.set({ anilist_search_cache: searchCache });

        return anilistId;
    }

    return null;
}

/**
 * Save Crunchyroll → AniList mapping
 */
async function saveCrunchyrollAnilistMapping(crunchyrollId, anilistId) {
    const result = await chrome.storage.local.get(['crunchyroll_anilist_mapping']);
    const mapping = result.crunchyroll_anilist_mapping || {};

    mapping[crunchyrollId] = anilistId;

    await chrome.storage.local.set({ crunchyroll_anilist_mapping: mapping });
}

/**
 * Start manual sync from popup
 */
async function startWatchlistSync() {
    const result = await chrome.storage.local.get(['crunchyroll_watchlist', 'token']);

    if (!result.token) {
        throw new Error('Not authenticated with AniList');
    }

    if (!result.crunchyroll_watchlist?.items) {
        throw new Error('No watchlist data available. Please visit your Crunchyroll watchlist first.');
    }

    // Filter items that need syncing
    const itemsToSync = result.crunchyroll_watchlist.items.filter(item =>
        item.sync_status !== 'synced' && item.last_episode_watched > 0
    );

    if (itemsToSync.length === 0) {
        return { message: 'All items already synced', synced: 0 };
    }

    console.log(`ALTA: Starting sync for ${itemsToSync.length} items`);

    // Add to sync queue
    await syncQueue.add(itemsToSync);

    return { message: 'Sync started', total: itemsToSync.length };
}

/**
 * Get current sync status
 */
async function getSyncStatus() {
    const result = await chrome.storage.local.get(['sync_status', 'crunchyroll_watchlist']);

    const watchlist = result.crunchyroll_watchlist || { items: [] };
    const syncedCount = watchlist.items.filter(i => i.sync_status === 'synced').length;
    const pendingCount = watchlist.items.filter(i => i.sync_status === 'pending').length;
    const errorCount = watchlist.items.filter(i => i.sync_status === 'error').length;

    return {
        ...result.sync_status,
        synced: syncedCount,
        pending: pendingCount,
        errors: errorCount,
        lastUpdated: watchlist.lastUpdated || null
    };
}

/**
 * Get watchlist items
 */
async function getWatchlistItems() {
    const result = await chrome.storage.local.get(['crunchyroll_watchlist']);
    return result.crunchyroll_watchlist || { items: [], total: 0 };
}

// ========================================
// CRUNCHYROLL API CLIENT
// ========================================

/**
 * Fetch watchlist directly from Crunchyroll API
 */
async function fetchCrunchyrollWatchlist() {
    console.log('ALTA: Fetching Crunchyroll watchlist from API...');

    // Get stored headers
    const result = await chrome.storage.local.get(['crunchyroll_headers']);

    if (!result.crunchyroll_headers) {
        throw new Error('Crunchyroll headers not available. Please visit www.crunchyroll.com first to capture authentication.');
    }

    const headers = result.crunchyroll_headers;
    console.log('ALTA: Using headers:', Object.keys(headers));

    // Extract user ID from Authorization header if it's a Bearer token
    // The discover endpoint needs a user GUID
    // We'll need to get this from the captured URL or make a discovery call

    // For now, let's try to find the user ID from a previous capture
    const guidMatch = await getDiscoverGuid();
    if (!guidMatch) {
        throw new Error('Could not determine user GUID. Please visit your Crunchyroll watchlist page first.');
    }

    console.log('ALTA: Using discover GUID:', guidMatch);

    // Build the API URL
    const apiUrl = `https://www.crunchyroll.com/content/v2/discover/${guidMatch}/watchlist?order=desc&sort_by=date_updated&n=100&locale=fr-FR`;

    console.log('ALTA: Fetching from:', apiUrl);

    // Make the request with captured headers
    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers
    });

    if (!response.ok) {
        throw new Error(`Crunchyroll API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ ALTA: Successfully fetched watchlist from API');
    console.log('  → Total items:', data.total);
    console.log('  → Data items:', data.data?.length || 0);

    // Store the data
    await handleWatchlistSync(data);

    return data;
}

/**
 * Get the discover GUID from storage or captured URL
 */
async function getDiscoverGuid() {
    const result = await chrome.storage.local.get(['crunchyroll_discover_guid']);
    return result.crunchyroll_discover_guid || null;
}

/**
 * Store the discover GUID when we capture it
 */
function storeDiscoverGuid(url) {
    const match = url.match(/\/discover\/([^\/]+)\//);
    if (match && match[1]) {
        chrome.storage.local.set({ crunchyroll_discover_guid: match[1] }, () => {
            console.log('ALTA: Stored discover GUID:', match[1]);
        });
    }
}

// Update the header capture to also capture the discover GUID
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.url.includes('/discover/') && details.url.includes('/watchlist')) {
            console.log('ALTA: Captured watchlist URL:', details.url);
            storeDiscoverGuid(details.url);
        }
    },
    { urls: ["https://www.crunchyroll.com/content/v2/discover/*/watchlist*"] }
);

console.log('ALTA Background Service Worker initialized');

