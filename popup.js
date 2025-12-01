// Debugging storage
console.log('Storage API available:', !!chrome.storage);
console.log('Local storage available:', !!chrome.storage.local);

// Vérifier le contenu actuel
chrome.storage.local.get(null, function (items) {
  console.log('Current storage contents:', items);
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in namespace "${namespace}" changed.`,
      `Old value was "${oldValue}", new value is "${newValue}".`
    );
  }
});

var doc = document;
var storage = chrome.storage.local;
const NAMESPACES = {
  token: "token",
  userId: "userId",
  type: "type"
};

// Si tu l'as déjà défini ailleurs, enlève-le
var client_id = clientData.clientId;
var webAuthUrl = "https://anilist.co/api/v2/oauth/authorize?client_id=" + client_id + "&response_type=token";

var token;
var userId = "";
var displayedType = "ANIME";
var fullList = [];
var displayedList = [];
const SERVICE_URL = "https://graphql.anilist.co";
const METHOD = "POST";

var headers = {
  "Authorization": "Bearer ",
  "Content-Type": "application/json",
  "Accept": "application/json"
};

var display = doc.getElementById("display");
const COLUMNS = 4;
const thumbHeight = 130;
const thumbWidth = 100;

var logIn = doc.getElementById("logIn");
var logOut = doc.getElementById("logout");

// ================== EVENTS ===================
logIn.addEventListener("click", function () {
  chrome.identity.launchWebAuthFlow({ url: webAuthUrl, interactive: true }, async function (redirectUrl) {
    let access_token = redirectUrl.match(/\#(?:access_token)\=([\S\s]*?)\&/)[1];
    token = access_token;

    try {
      await saveToIndexedDB('userData', {
        id: 'user',
        token: token,
        userId: userId
      });
      console.log('Token saved to IndexedDB');

      console.log('Saving token:', token);

      chrome.storage.local.set({ [NAMESPACES.token]: token }, function () {
        if (chrome.runtime.lastError) {
          console.error('Token storage error:', chrome.runtime.lastError);
        } else {
          console.log('Token saved successfully');
          headers["Authorization"] = "Bearer " + token;

          if (token) {
            let query = `
              query {
                Viewer {
                  id
                }
              }
            `;
            let options = getOptions(query);
            fetch(SERVICE_URL, options)
              .then(handleResponse)
              .then(function (response) {
                if (!response.data || !response.data.Viewer) {
                  console.error("Impossible de récupérer l'userId : ", response);
                  return;
                }
                userId = response.data.Viewer.id;
                chrome.storage.local.set({ [NAMESPACES.userId]: userId });
                logIn.style.display = "none";
                logOut.style.display = "";
                refreshList();
              })
              .catch(handleError);
          }
        }
      });
    } catch (err) {
      console.error('Error saving token:', err);
    }
  });
});

logOut.addEventListener("click", function () {
  chrome.storage.local.set({
    [NAMESPACES.token]: "",
    [NAMESPACES.userId]: ""
  }, function () {
    console.log('Logout storage cleared');
  });
  headers["Authorization"] = "Bearer ";
  token = "";
  userId = "";
  refreshList();
  logOut.style.display = "none";
  logIn.style.display = "";
  logOut.style.display = "none";
  logIn.style.display = "";
});

// Listen for refresh messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'REFRESH_UI') {
    console.log('Popup: Received refresh request');
    refreshList();
  }
});

// ================== GET OPTIONS ===================
function getOptions(query, variables) {
  let options = {
    method: METHOD,
    headers: headers,
    body: JSON.stringify({ query, variables })
  };
  return options;
}

// ================== REFRESH LIST ===================
async function refreshList() {
  // Pour forcer un refresh sans cache => on met maxAgeSeconds à 0 ou un truc bas
  fullList = await getWatching(/* noCache = true */);
  displayedList = fullList;
  computeStatsFromList(fullList);
  updateImages();
}

// ================== GET GLOBAL STATS ===================
async function getGlobalStats() {
  const query = `
    query {
      Viewer {
        statistics {
          anime {
            episodesWatched
            meanScore
            count
          }
        }
      }
    }
  `;

  try {
    let res = await fetch(SERVICE_URL, getOptions(query));
    let json = await res.json();

    // Vérifier si l'API renvoie des erreurs
    if (json.errors) {
      console.error("AniList GraphQL errors (getGlobalStats) =>", json.errors);
      return null; // ou un objet partiel
    }
    if (!json.data || !json.data.Viewer) {
      console.error("Réponse inattendue (getGlobalStats) =>", json);
      return null;
    }

    // On renvoie la partie "anime"
    return json.data.Viewer.statistics.anime;
  } catch (err) {
    console.error("Erreur getGlobalStats()", err);
    return null;
  }
}

// ================== FETCH ALL ANIME ===================
async function fetchAllAnime(userId) {
  let page = 1;
  let perPage = 50;
  let allEntries = [];

  while (true) {
    let query = `
      query($page:Int, $perPage:Int, $userId:Int){
        Page(page:$page, perPage:$perPage){
          pageInfo {
            hasNextPage
            currentPage
          }
          mediaList(userId:$userId, type:ANIME, status_in:[CURRENT, PAUSED]){
            id
            progress
            media {
              id
              episodes
              title {
                english
              }
            }
          }
        }
      }
    `;
    let variables = { page, perPage, userId };
    let res = await fetch(SERVICE_URL, getOptions(query, variables));
    let json = await res.json();

    if (json.errors) {
      console.error("AniList errors =>", json.errors);
      break;
    }
    let pageData = json.data.Page;
    allEntries = allEntries.concat(pageData.mediaList);

    if (!pageData.pageInfo.hasNextPage) {
      break;
    }
    page++;
  }

  return allEntries;
}

// ================== STATS ===================
function computeStatsFromList(animeList) {
  if (!animeList) return;

  let totalProgress = 0;
  animeList.forEach(item => {
    totalProgress += item.progress || 0;
  });

  const avgEpisodeMinutes = 24;
  let totalTime = totalProgress * avgEpisodeMinutes;

  console.log('Saving stats:', {
    totalEpisodesWatched: totalProgress,
    totalMinutesWatched: totalTime
  });

  chrome.storage.local.set({
    totalEpisodesWatched: totalProgress,
    totalMinutesWatched: totalTime
  }, function () {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
    } else {
      console.log('Stats saved successfully');
    }
  });
}

// ================== GET WATCHING ===================
async function getWatching(noCache) {
  let type, format;
  if (displayedType === "MANGA") {
    type = "MANGA";
    format = "chapters";
  } else {
    type = "ANIME";
    format = "episodes";
  }

  // Si pas de userId, retourner une liste vide
  if (!userId) {
    console.log("No userId found, returning empty list");
    return [];
  }

  if (noCache) {
    let query = `
      query($userId:Int){
        MediaListCollection(userId:$userId, type:${type}, status_in:[CURRENT,PAUSED], sort:UPDATED_TIME){
          lists {
            name
            status
            entries {
              id
              mediaId
              progress
              status
              score
              media {
                ${format}
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
              }
            }
          }
        }
      }
    `;
    let variables = { userId: parseInt(userId) };

    let res = await fetch(SERVICE_URL, getOptions(query, variables))
      .then(r => r.json())
      .catch(e => {
        console.error("Error fetching from AniList:", e);
        return null;
      });

    // Ajout des logs de débogage
    console.log("API Response:", res);

    // Le problème est probablement ici - la structure de la réponse est différente
    if (!res?.data?.MediaListCollection?.lists) {
      console.log("No lists found in API response");
      return [];
    }

    // Modification pour gérer plusieurs listes
    const allEntries = res.data.MediaListCollection.lists.reduce((acc, list) => {
      console.log("Processing list:", list.name, "with status:", list.status);
      return acc.concat(list.entries || []);
    }, []);

    console.log("All entries combined:", allEntries);

    // Sauvegarder dans IndexedDB
    for (let entry of allEntries) {
      try {
        await saveMediaToIndexedDB(entry, type);
      } catch (err) {
        console.error('Error saving to IndexedDB:', err);
      }
    }

    return allEntries;
  }

  // Essayer de récupérer depuis IndexedDB
  try {
    if (!db) {
      console.log("IndexedDB not initialized, fetching from API");
      return getWatching(true);
    }

    const media = await getFromIndexedDB(type);
    console.log(`Retrieved ${media.length} entries from IndexedDB`);

    if (media.length === 0) {
      console.log("No entries in IndexedDB, fetching from API");
      return getWatching(true);
    }

    return media;
  } catch (err) {
    console.error('Error reading from IndexedDB:', err);
    return getWatching(true);
  }
}

// ================== SIMPLE FETCH WITH CACHE ===================
function fetchWithCache(cacheKey, query, variables, maxAgeSeconds = 3600) {
  return new Promise((resolve, reject) => {
    let now = Date.now();
    chrome.storage.local.get([cacheKey], function (result) {
      if (result[cacheKey]) {
        let { data, timestamp } = result[cacheKey];
        let age = (now - timestamp) / 1000;
        if (age < maxAgeSeconds) {
          return resolve(data);
        }
      }
      fetch(SERVICE_URL, getOptions(query, variables))
        .then(r => r.json())
        .then(json => {
          let toStore = {
            data: json,
            timestamp: now
          };
          chrome.storage.local.set({ [cacheKey]: toStore }, () => {
            resolve(json);
          });
        })
        .catch(err => reject(err));
    });
  });
}

// ================== HANDLE/UPDATE ===================
function handleResponse(response) {
  return response.json().then(function (json) {
    return response.ok ? json : Promise.reject(json);
  });
}

function handleError(error) {
  console.error("Error:", error);
}

// ================== UPDATE IMAGES ===================
function updateImages() {
  // On vide d’abord le container
  display.innerHTML = "";

  if (!Array.isArray(displayedList) || displayedList.length === 0) {
    let noItems = doc.createElement("H5");
    let textString = token
      ? "Doesn't look like there's anything here..."
      : "Doesn't look like you're logged in yet";
    noItems.appendChild(doc.createTextNode(textString));
    display.appendChild(noItems);
    return;
  }

  for (let i = displayedList.length - 1; i >= 0; i--) {
    let mediaList = displayedList[i];
    let cellDiv = document.createElement("div");
    cellDiv.className = "cell";

    let aniListUrl = `https://anilist.co/anime/${mediaList.mediaId}`;
    let totalEpisodes = (displayedType === "MANGA")
      ? (mediaList.media.chapters || "")
      : (mediaList.media.episodes || "");

    let imgHtmlString = `
      <a href="${aniListUrl}" target="_blank" style="text-decoration:none;">
        <img
          id="mediaList-${mediaList.id}"
          src="${mediaList.media.coverImage.medium}"
          alt="${mediaList.media.title.english || 'Anime Cover'}"
        />
        <div class="title-overlay">
          <span>${mediaList.media.title.english || mediaList.media.title.native || 'Untitled'}</span>
        </div>
      </a>
    `;
    let decrement = `
      <button
        id="dec-${mediaList.id}"
        style="float:left;"
      >-</button>
    `;
    let text = `
      <span id="prog-${mediaList.id}">${mediaList.progress}/${totalEpisodes || "?"}</span>
    `;
    let increment = `
      <button
        id="inc-${mediaList.id}"
        style="float:right;"
      >+</button>
    `;
    let span = `<div class="centerText">${decrement} ${text} ${increment}</div>`;

    cellDiv.innerHTML = imgHtmlString + span;

    // ===> ICI : CLIC DROIT pour ouvrir le menu contextuel
    cellDiv.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      // Montre un menu permettant de choisir le statut
      showStatusMenu(e.clientX, e.clientY, mediaList);
    });

    display.appendChild(cellDiv);
  }

  function showStatusMenu(x, y, mediaList) {
    // On supprime un éventuel menu déjà affiché
    const oldMenu = doc.getElementById("statusMenu");
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement("div");
    menu.id = "statusMenu";
    menu.style.position = "fixed";
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.backgroundColor = "#24283b";
    menu.style.border = "1px solid #414868";
    menu.style.borderRadius = "6px";
    menu.style.padding = "8px";
    menu.style.zIndex = 999999;
    menu.style.minWidth = "150px";

    // Statuts avec leurs icônes correspondantes
    const statusConfig = {
      "CURRENT": { icon: "fa-solid fa-play", color: "#7aa2f7" },
      "COMPLETED": { icon: "fa-solid fa-check", color: "#9ece6a" },
      "PAUSED": { icon: "fa-solid fa-pause", color: "#e0af68" },
      "DROPPED": { icon: "fa-solid fa-xmark", color: "#f7768e" },
      "PLANNING": { icon: "fa-solid fa-clock", color: "#bb9af7" }
    };

    Object.entries(statusConfig).forEach(([st, config]) => {
      let btn = document.createElement("button");
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.gap = "8px";
      btn.style.width = "100%";
      btn.style.margin = "4px 0";
      btn.style.padding = "8px 12px";

      // Ajout de l'icône
      let icon = document.createElement("i");
      icon.className = config.icon;
      icon.style.color = config.color;
      icon.style.width = "16px";

      let text = document.createElement("span");
      text.textContent = st;

      btn.appendChild(icon);
      btn.appendChild(text);

      if (st === mediaList.status) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.title = "Current status";
      } else {
        btn.addEventListener("click", function () {
          updateAnimeStatus(mediaList.id, st);
          menu.remove();
        });
      }
      menu.appendChild(btn);
    });

    // Pour fermer le menu en cliquant hors de celui-ci
    setTimeout(() => {
      document.addEventListener("click", function handleClickOutside(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", handleClickOutside);
        }
      });
    }, 0);

    document.body.appendChild(menu);
  }

  // On ajoute les listeners +/- existants
  for (let i = displayedList.length - 1; i >= 0; i--) {
    let mediaList = displayedList[i];
    doc.getElementById(`dec-${mediaList.id}`)
      .addEventListener("click", mediaClick(mediaList, -1));
    doc.getElementById(`inc-${mediaList.id}`)
      .addEventListener("click", mediaClick(mediaList, 1));
  }
}

// Fonction pour filtrer et sauvegarder un anime
async function saveAnimeToIndexedDB(animeData) {
  try {
    // On vérifie d'abord si le statut est CURRENT ou PAUSED
    if (animeData.status !== 'CURRENT' && animeData.status !== 'PAUSED') {
      // Si ce n'est pas le cas, on le supprime de IndexedDB s'il existe
      const store = db.transaction('animeList', 'readwrite').objectStore('animeList');
      await store.delete(animeData.id);
      return null;
    }

    const store = db.transaction('animeList', 'readwrite').objectStore('animeList');

    const enrichedData = {
      id: animeData.id,
      mediaId: animeData.mediaId,
      progress: animeData.progress,
      totalEpisodes: animeData.media?.episodes || null,
      title: {
        english: animeData.media?.title?.english || null,
        native: animeData.media?.title?.native || null
      },
      coverImage: {
        medium: animeData.media?.coverImage?.medium || null,
        large: animeData.media?.coverImage?.large || null,
        extraLarge: animeData.media?.coverImage?.extraLarge || null
      },
      bannerImage: animeData.media?.bannerImage || null,
      status: animeData.status, // CURRENT ou PAUSED uniquement
      format: animeData.media?.format || null,
      season: animeData.media?.season || null,
      seasonYear: animeData.media?.seasonYear || null,
      genres: animeData.media?.genres || [],
      averageScore: animeData.media?.averageScore || null,
      popularity: animeData.media?.popularity || null,
      nextAiringEpisode: animeData.media?.nextAiringEpisode || null,
      lastUpdated: Date.now()
    };

    await store.put(enrichedData);
    console.log('Anime saved/updated in IndexedDB:', enrichedData);
    return enrichedData;
  } catch (err) {
    console.error('Error saving anime to IndexedDB:', err);
    throw err;
  }
}

// Fonction pour mettre à jour un anime spécifique via l'API
async function updateAnimeFromAPI(mediaId) {
  const query = `
    query($userId:Int, $mediaId:Int){
      MediaList(userId:$userId, mediaId:$mediaId) {
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

  const variables = {
    userId: parseInt(userId),
    mediaId: parseInt(mediaId)
  };

  try {
    const res = await fetch(SERVICE_URL, getOptions(query, variables));
    const json = await res.json();

    if (json.errors) {
      console.error("API Errors:", json.errors);
      return null;
    }

    if (!json.data || !json.data.MediaList) {
      console.error("No data returned from API");
      return null;
    }

    // Sauvegarder dans IndexedDB si c'est CURRENT ou PAUSED
    const animeData = json.data.MediaList;
    return await saveAnimeToIndexedDB(animeData);
  } catch (err) {
    console.error('Error updating anime from API:', err);
    return null;
  }
}

// Mise à jour de mediaClick pour utiliser IndexedDB
function mediaClick(mediaList, i) {
  return function (e) {
    clearTimeout(clickTimers[mediaList.id]);

    const newProgress = mediaList.progress + i;
    const query = `
      mutation($id:Int,$progress:Int){
        SaveMediaListEntry(id:$id, progress:$progress){
          id
          progress
          status
        }
      }
    `;
    const variables = {
      id: mediaList.id,
      progress: newProgress
    };

    clickTimers[mediaList.id] = setTimeout(async () => {
      try {
        const res = await fetch(SERVICE_URL, getOptions(query, variables));
        const json = await res.json();

        if (json.errors) {
          console.error("API Errors:", json.errors);
          return;
        }

        // Mettre à jour l'anime complet via l'API
        await updateAnimeFromAPI(mediaList.mediaId);

        // Rafraîchir l'affichage depuis IndexedDB
        displayedList = await getFromIndexedDB();
        updateImages();

        if (i > 0) {
          updateStats(i);
        }
      } catch (err) {
        console.error('Error updating progress:', err);
      }
    }, 300);
  };
}

// Mise à jour de updateAnimeStatus pour gérer IndexedDB
async function updateAnimeStatus(listEntryId, newStatus) {
  const query = `
    mutation($id:Int, $status:MediaListStatus) {
      SaveMediaListEntry(id:$id, status:$status) {
        id
        mediaId
        status
        media {
          title {
            english
            native
          }
        }
      }
    }
  `;

  const variables = {
    id: listEntryId,
    status: newStatus
  };

  try {
    const res = await fetch(SERVICE_URL, getOptions(query, variables));
    const json = await res.json();

    if (json.errors) {
      console.error("API Errors:", json.errors);
      return;
    }

    const savedEntry = json.data.SaveMediaListEntry;
    console.log('Status updated to:', newStatus, 'for anime:', savedEntry.media.title.english); // Debug log

    if (newStatus === 'CURRENT' || newStatus === 'PAUSED') {
      // Mettre à jour l'anime complet dans IndexedDB
      await updateAnimeFromAPI(savedEntry.mediaId);
    } else {
      // Supprimer de IndexedDB si ce n'est plus CURRENT ou PAUSED
      const store = db.transaction('animeList', 'readwrite').objectStore('animeList');
      await store.delete(savedEntry.id);
    }

    // Forcer un rafraîchissement complet depuis l'API
    fullList = await getWatching(true);
    displayedList = fullList;
    updateImages();
  } catch (err) {
    console.error('Error updating anime status:', err);
  }
}

// ================== STATS (SAME) ===================
function updateStats(increment) {
  const avgEpisodeMinutes = 24;
  chrome.storage.local.get(["totalEpisodesWatched", "totalMinutesWatched"], function (res) {
    let epCount = res.totalEpisodesWatched || 0;
    let minCount = res.totalMinutesWatched || 0;
    epCount += increment;
    minCount += (increment * avgEpisodeMinutes);
    chrome.storage.local.set({
      totalEpisodesWatched: epCount,
      totalMinutesWatched: minCount
    });
  });
}

// ================== SHOW PANEL ===================
function showStats() {
  showPanel("<h2>Global Stats</h2><div id='globalStats'></div><button id='closePanel'>Close</button>");

  getGlobalStats().then(animeStats => {
    if (!animeStats) {
      doc.getElementById("globalStats").innerHTML = `<p>Impossible to get global stats</p>`;
      return;
    }
    let globalHtml = `
      <p>Episodes Watched: ${animeStats.episodesWatched}</p>
      <p>Total Animes: ${animeStats.count}</p>
      <p>Mean Score: ${animeStats.meanScore}</p>
    `;
    doc.getElementById("globalStats").innerHTML = globalHtml;
  });
}

// ================== SHOW NOTIFICATIONS ===================
function showNotifications() {
  chrome.storage.local.get(["notificationsHistory"], function (result) {
    let history = result.notificationsHistory || [];
    if (history.length === 0) {
      let html = `
        <h2>Recent notifications</h2>
        <p>No notifications found.</p>
        <button id="closePanel">Close</button>
      `;
      showPanel(html);
      return;
    }
    let notifHtml = history
      .slice().reverse()
      .map(entry => {
        let dateString = new Date(entry.date).toLocaleString();
        return `
          <div style="margin-bottom: 8px;">
            <strong>${entry.animeTitle} - Episode ${entry.episodeNumber}</strong>
            <br>
            <span style="font-size: 0.9em; color: #888;">${dateString}</span>
          </div>
        `;
      })
      .join("");

    let html = `
      <h2>Recent notifications</h2>
      <div style="max-height: 200px; overflow-y: auto;">
        ${notifHtml}
      </div>
      <button id="clearNotifications">Clear all</button>
      <button id="closePanel">Close</button>
    `;
    showPanel(html);

    let clearBtn = doc.getElementById("clearNotifications");
    clearBtn.addEventListener("click", function () {
      chrome.storage.local.set({ notificationsHistory: [] }, function () {
        showPanel(`
          <h2>Recent notifications</h2>
          <p>No notifications found.</p>
          <button id="closePanel">Close</button>
        `);
        let closeBtn2 = doc.getElementById("closePanel");
        closeBtn2.addEventListener("click", () => {
          overlayPanel.style.display = "none";
        });
      });
    });
  });
}

// ================== OVERLAY PANEL ===================
var overlayPanel = doc.getElementById("overlayPanel");
function showPanel(innerHtml) {
  overlayPanel.innerHTML = innerHtml;
  overlayPanel.style.display = "block";
  // on ajoute la classe pour animer
  overlayPanel.classList.remove("animate-in");
  void overlayPanel.offsetWidth; // trigger reflow
  overlayPanel.classList.add("animate-in");

  let closeBtn = overlayPanel.querySelector("#closePanel");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      overlayPanel.style.display = "none";
      overlayPanel.classList.remove("animate-in");
    });
  }
}

// ================== TOGGLE / SEARCH / ICONS ===================
async function toggleList() {
  displayedType = (displayedType === "ANIME") ? "MANGA" : "ANIME";
  doc.getElementById("listType").innerHTML = displayedType;

  chrome.storage.local.set({
    [NAMESPACES.type]: displayedType
  }, function () {
    if (chrome.runtime.lastError) {
      console.error('Error saving displayedType:', chrome.runtime.lastError);
    } else {
      console.log('DisplayedType saved:', displayedType);
    }
  });

  fullList = await getWatching(true);
  displayedList = fullList;
  computeStatsFromList(fullList);
  updateImages();
}

function searchList(e) {
  e.preventDefault();
  let query = searchInput.value.trim().toUpperCase();
  if (query) {
    displayedList = fullList.filter(function (item) {
      let english = item.media.title.english || "";
      return (
        english.toUpperCase().includes(query)
      );
    });
  } else {
    displayedList = fullList;
  }
  updateImages();
}

var toggleBtn = doc.getElementById("toggle");
toggleBtn.addEventListener("click", toggleList);

var searchInput = doc.getElementById("search");
var searchButton = doc.getElementById("go");
searchButton.addEventListener("click", searchList);

var notificationIcon = doc.getElementById("notificationIcon");
if (notificationIcon) {
  notificationIcon.addEventListener("click", showNotifications);
}
var statsIcon = doc.getElementById("statsIcon");
if (statsIcon) {
  statsIcon.addEventListener("click", showStats);
}

// ================== ON LOAD (INIT) ===================
// ================== ON LOAD (INIT) ===================
window.addEventListener('load', async function () {
  try {
    // 1. Initialize IndexedDB first
    await initDB();
    console.log('IndexedDB ready');

    // 2. Check for clientData
    if (typeof clientData === 'undefined') {
      console.error('clientData is missing. Please configure data.js');
      document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h2>Configuration Error</h2><p>Please configure <code>data.js</code> with your AniList API credentials.</p></div>';
      return;
    }

    // 3. Initialize global variables from clientData
    // Ensure these are set before use
    if (typeof client_id === 'undefined') {
      window.client_id = clientData.clientId;
      window.webAuthUrl = "https://anilist.co/api/v2/oauth/authorize?client_id=" + client_id + "&response_type=token";
    }

    // 4. Load settings from storage
    chrome.storage.local.get([NAMESPACES.token, NAMESPACES.userId, NAMESPACES.type], async function (result) {
      console.log('Initial storage load:', result);

      displayedType = result.type || "ANIME";
      const listTypeEl = doc.getElementById("listType");
      if (listTypeEl) listTypeEl.innerHTML = displayedType;

      token = result.token;
      if (token) {
        headers["Authorization"] = "Bearer " + token;
      }
      userId = result.userId;

      // Update UI based on auth state
      if (token && userId) {
        if (logIn) logIn.style.display = "none";
        if (logOut) logOut.style.display = "flex"; // Changed to flex for alignment
      } else {
        if (logOut) logOut.style.display = "none";
        if (logIn) logIn.style.display = "flex";
      }

      // 5. Fetch and display data
      try {
        fullList = await getWatching(true);
        displayedList = fullList;
        computeStatsFromList(fullList);
        updateImages();
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    });

  } catch (err) {
    console.error('Failed to initialize:', err);
  }
});

// Remove the old standalone chrome.storage.local.get call that was causing race conditions
// (The one that was around line 930)

// ... (rest of the file functions: initDB, saveToIndexedDB, etc.)

// ================== INDEXEDDB FUNCTIONS ===================

const DB_NAME = 'alta-storage';
const DB_VERSION = 5;
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION + 1);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log("IndexedDB initialized successfully");
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('mangaList')) {
        const mangaStore = db.createObjectStore('mangaList', { keyPath: 'id' });
        mangaStore.createIndex('mediaId', 'mediaId', { unique: false });
        mangaStore.createIndex('title', ['title.english'], { unique: false });
        mangaStore.createIndex('status', 'status', { unique: false });
        mangaStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }

      if (!db.objectStoreNames.contains('userData')) {
        const userStore = db.createObjectStore('userData', { keyPath: 'id' });
        userStore.createIndex('lastLogin', 'lastLogin', { unique: false });
      }

      if (!db.objectStoreNames.contains('animeList')) {
        const animeStore = db.createObjectStore('animeList', { keyPath: 'id' });
        animeStore.createIndex('mediaId', 'mediaId', { unique: false });
        animeStore.createIndex('title', ['title.english'], { unique: false });
        animeStore.createIndex('status', 'status', { unique: false });
        animeStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }

      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
        notifStore.createIndex('animeId', 'animeId', { unique: false });
        notifStore.createIndex('date', 'date', { unique: false });
        notifStore.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('stats')) {
        const statsStore = db.createObjectStore('stats', { keyPath: 'id' });
        statsStore.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeNotification(animeTitle, episodeNumber, animeId, coverImage) {
  chrome.storage.local.get(["notificationsHistory"], async function (result) {
    let history = result.notificationsHistory || [];
    const notif = {
      animeTitle: animeTitle,
      episodeNumber: episodeNumber,
      animeId: animeId,
      coverImage: coverImage,
      date: Date.now()
    };
    history.push(notif);
    try {
      if (db) await saveToIndexedDB('notifications', notif);
      chrome.storage.local.set({ notificationsHistory: history });
    } catch (err) {
      console.error('Error saving notification:', err);
    }
  });
}

async function getFromIndexedDB(type) {
  if (!db) return [];
  const storeName = type === 'MANGA' ? 'mangaList' : 'animeList';
  const transaction = db.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);

  const media = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const filtered = request.result.filter(item =>
        item.status === 'CURRENT' || item.status === 'PAUSED'
      );
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });

  if (media.length === 0) {
    return getWatching(true);
  }
  return media;
}

async function saveMediaToIndexedDB(mediaData, type) {
  if (!db) return null;
  try {
    if (mediaData.status !== 'CURRENT' && mediaData.status !== 'PAUSED') {
      const store = db.transaction(type === 'MANGA' ? 'mangaList' : 'animeList', 'readwrite')
        .objectStore(type === 'MANGA' ? 'mangaList' : 'animeList');
      await store.delete(mediaData.id);
      return null;
    }

    const storeName = type === 'MANGA' ? 'mangaList' : 'animeList';
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);

    const enrichedData = {
      id: mediaData.id,
      mediaId: mediaData.mediaId,
      progress: mediaData.progress,
      status: mediaData.status,
      score: mediaData.score,
      media: mediaData.media,
      lastUpdated: Date.now()
    };

    await store.put(enrichedData);
    return enrichedData;
  } catch (err) {
    console.error(`Error saving to IndexedDB:`, err);
    throw err;
  }
}

// ========================================
// WATCHLIST SYNC UI
// ========================================

const watchlistSyncIcon = document.getElementById('watchlistSyncIcon');
const watchlistSyncPanel = document.getElementById('watchlistSyncPanel');
const closeSyncPanel = document.getElementById('closeSyncPanel');
const btnSyncWatchlist = document.getElementById('btn-sync-watchlist');
const syncProgress = document.getElementById('sync-progress');
const watchlistItems = document.getElementById('watchlist-items');

// Toggle panel
watchlistSyncIcon?.addEventListener('click', () => {
  const isVisible = watchlistSyncPanel.style.display === 'block';
  watchlistSyncPanel.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) {
    loadWatchlistStatus();
    loadWatchlistItems();
  }
});

closeSyncPanel?.addEventListener('click', () => {
  watchlistSyncPanel.style.display = 'none';
});

// Manual sync trigger
btnSyncWatchlist?.addEventListener('click', async () => {
  try {
    btnSyncWatchlist.classList.add('syncing');
    btnSyncWatchlist.disabled = true;
    btnSyncWatchlist.innerHTML = '<i class="fas fa-sync-alt"></i> Récupération des données Crunchyroll...';

    // First, fetch watchlist from Crunchyroll API
    const fetchResponse = await chrome.runtime.sendMessage({
      action: 'FETCH_CRUNCHYROLL_WATCHLIST'
    });

    if (!fetchResponse.success) {
      alert('Erreur lors de la récupération des données Crunchyroll: ' + fetchResponse.error);
      resetSyncButton();
      return;
    }

    console.log('Watchlist fetched from Crunchyroll:', fetchResponse.data);
    btnSyncWatchlist.innerHTML = '<i class="fas fa-sync-alt"></i> Synchronisation avec AniList...';

    // Then start AniList sync
    const response = await chrome.runtime.sendMessage({
      action: 'START_WATCHLIST_SYNC'
    });

    if (response.success) {
      console.log('Sync started:', response.data);
      syncProgress.style.display = 'block';
    } else {
      alert('Erreur: ' + response.error);
      resetSyncButton();
    }
  } catch (error) {
    console.error('Error starting sync:', error);
    alert('Erreur lors du démarrage de la synchronisation');
    resetSyncButton();
  }
});

function resetSyncButton() {
  btnSyncWatchlist.classList.remove('syncing');
  btnSyncWatchlist.disabled = false;
  btnSyncWatchlist.innerHTML = '<i class="fas fa-sync-alt"></i> Synchroniser Maintenant';
}

// Load status
async function loadWatchlistStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_SYNC_STATUS'
    });

    if (response.success) {
      const status = response.data;

      // Update UI
      document.getElementById('watchlist-total').textContent = (status.synced || 0) + (status.pending || 0);
      document.getElementById('watchlist-synced').textContent = status.synced || 0;
      document.getElementById('watchlist-pending').textContent = status.pending || 0;
      document.getElementById('watchlist-errors').textContent = status.errors || 0;

      if (status.lastUpdated) {
        const date = new Date(status.lastUpdated);
        document.getElementById('watchlist-last-update').textContent = date.toLocaleString('fr-FR');
      }

      // Update progress if syncing
      if (status.status === 'syncing') {
        syncProgress.style.display = 'block';
        updateProgress(status.current, status.total);
        btnSyncWatchlist.classList.add('syncing');
        btnSyncWatchlist.disabled = true;
      } else if (status.status === 'completed') {
        syncProgress.style.display = 'none';
        resetSyncButton();
      }
    }
  } catch (error) {
    console.error('Error loading status:', error);
  }
}

// Load items
async function loadWatchlistItems() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_WATCHLIST_ITEMS'
    });

    if (response.success) {
      const data = response.data;
      displayWatchlistItems(data.items || []);
    }
  } catch (error) {
    console.error('Error loading items:', error);
  }
}

// Display items
function displayWatchlistItems(items) {
  watchlistItems.innerHTML = '';

  if (items.length === 0) {
    watchlistItems.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:20px;">Aucun anime dans la watchlist.<br>Visitez votre watchlist Crunchyroll pour charger les données.</p>';
    return;
  }

  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'watchlistItem';

    const statusClass = item.sync_status || 'pending';
    const statusText = {
      'pending': 'En attente',
      'syncing': 'Sync en cours',
      'synced': 'Synchronisé',
      'error': 'Erreur'
    }[statusClass] || statusClass;

    itemDiv.innerHTML = `
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.series_title}">` : ''}
      <div class="watchlistItemInfo">
        <div class="watchlistItemTitle" title="${item.series_title}">${item.series_title}</div>
        <div class="watchlistItemProgress">
          ${item.season_title} • Épisode ${item.last_episode_watched} regardé
        </div>
        <span class="watchlistItemStatus ${statusClass}">${statusText}</span>
      </div>
    `;

    watchlistItems.appendChild(itemDiv);
  });
}

// Update progress bar
function updateProgress(current, total) {
  const percentage = (current / total) * 100;
  document.getElementById('sync-progress-fill').style.width = percentage + '%';
  document.getElementById('sync-current').textContent = current;
  document.getElementById('sync-total').textContent = total;
}

// Listen for sync progress updates from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SYNC_PROGRESS_UPDATE') {
    const { status, current, total } = request.data;

    if (status === 'syncing') {
      syncProgress.style.display = 'block';
      updateProgress(current, total);
    } else if (status === 'completed') {
      syncProgress.style.display = 'none';
      resetSyncButton();
      loadWatchlistStatus();
      loadWatchlistItems();
    }
  }

  // Existing REFRESH_UI handler
  if (request.action === 'REFRESH_UI') {
    console.log('Popup: Received refresh request');
    refreshList();
  }
});

console.log('ALTA Popup initialized with Watchlist Sync');