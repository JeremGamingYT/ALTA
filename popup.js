// Debugging storage
console.log('Storage API available:', !!chrome.storage);
console.log('Local storage available:', !!chrome.storage.local);

// Vérifier le contenu actuel
chrome.storage.local.get(null, function(items) {
  console.log('Current storage contents:', items);
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
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
logIn.addEventListener("click", function() {
  chrome.identity.launchWebAuthFlow({ url: webAuthUrl, interactive: true }, async function(redirectUrl) {
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
      
      chrome.storage.local.set({ [NAMESPACES.token]: token }, function() {
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
              .then(function(response) {
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

logOut.addEventListener("click", function() {
  chrome.storage.local.set({ 
    [NAMESPACES.token]: "", 
    [NAMESPACES.userId]: "" 
  }, function() {
    console.log('Logout storage cleared');
  });
  headers["Authorization"] = "Bearer ";
  token = "";
  userId = "";
  refreshList();
  logOut.style.display = "none";
  logIn.style.display = "";
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
  }, function() {
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

  let query = `
    query($userId:Int){
      MediaListCollection(userId:$userId, type:${type}, status_in:[CURRENT, PAUSED], sort:UPDATED_TIME){
        lists {
          entries {
            id
            mediaId
            progress
            status
            score
            startedAt {
              year
              month
              day
            }
            completedAt {
              year
              month
              day
            }
            notes
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
      }
    }
  `;
  let variables = { userId: parseInt(userId) };

  if (noCache) {
    let res = await fetch(SERVICE_URL, getOptions(query, variables))
      .then(r => r.json())
      .catch(e => {
        console.log("Reponse de AniList (getWatching):", JSON.stringify(res, null, 2));
        return null;
      });
    if (!res || !res.data || !res.data.MediaListCollection) {
      console.log("Aucune liste trouvée ou data manquante =>", res);
      return [];
    }
    if (!res.data.MediaListCollection.lists || res.data.MediaListCollection.lists.length === 0) {
      return [];
    }

    // Sauvegarder chaque média dans IndexedDB
    const entries = res.data.MediaListCollection.lists[0].entries || [];
    for (let entry of entries) {
      if (entry.status === 'CURRENT' || entry.status === 'PAUSED') {
        try {
          await saveMediaToIndexedDB(entry, type);
        } catch (err) {
          console.error('Error saving media to IndexedDB:', err);
        }
      }
    }
    return entries;
  }

  // Si pas noCache, essayer d'abord de récupérer depuis IndexedDB
  try {
    const media = await getFromIndexedDB(type);
    
    // Si les données ont plus d'une heure, forcer un refresh
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (media.length === 0 || media.some(m => m.lastUpdated < oneHourAgo)) {
      return getWatching(true);
    }
    return media;
  } catch (err) {
    console.error('Error reading from IndexedDB:', err);
    return getWatching(true);
  }
}

// ================== SIMPLE FETCH WITH CACHE ===================
function fetchWithCache(cacheKey, query, variables, maxAgeSeconds=3600) {
  return new Promise((resolve, reject) => {
    let now = Date.now();
    chrome.storage.local.get([cacheKey], function(result) {
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
  return response.json().then(function(json) {
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
          height="${thumbHeight}px"
          width="${thumbWidth}px"
          src="${mediaList.media.coverImage.medium}"
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
    cellDiv.addEventListener("contextmenu", function(e) {
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
    menu.style.minWidth = "100px";
  
    // Quelques choix de statuts
    const statuses = ["CURRENT", "COMPLETED", "PAUSED", "DROPPED", "PLANNING"];
  
    statuses.forEach(st => {
      let btn = document.createElement("button");
      btn.textContent = st;
      btn.style.display = "block";
      btn.style.margin = "4px 0";
      btn.addEventListener("click", function() {
        // Quand on clique sur un statut, on appelle la mutation
        updateAnimeStatus(mediaList.id, st);
        // On retire le menu
        menu.remove();
      });
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
  return function(e) {
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
    
    if (newStatus === 'CURRENT' || newStatus === 'PAUSED') {
      // Mettre à jour l'anime complet dans IndexedDB
      await updateAnimeFromAPI(savedEntry.mediaId);
    } else {
      // Supprimer de IndexedDB si ce n'est plus CURRENT ou PAUSED
      const store = db.transaction('animeList', 'readwrite').objectStore('animeList');
      await store.delete(savedEntry.id);
    }

    // Rafraîchir la liste complète
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
  chrome.storage.local.get(["totalEpisodesWatched", "totalMinutesWatched"], function(res) {
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
  chrome.storage.local.get(["notificationsHistory"], function(result) {
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
    clearBtn.addEventListener("click", function() {
      chrome.storage.local.set({ notificationsHistory: [] }, function() {
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
  }, function() {
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
    displayedList = fullList.filter(function(item) {
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
chrome.storage.local.get([NAMESPACES.token, NAMESPACES.userId, NAMESPACES.type], async function(result) {
  console.log('Initial storage load:', result);
  
  displayedType = result.type || "ANIME";
  doc.getElementById("listType").innerHTML = displayedType;

  token = result.token;
  headers["Authorization"] = "Bearer " + token;
  userId = result.userId;

  if (token && userId) {
    logIn.style.display = "none";
  } else {
    logOut.style.display = "none";
  }

  fullList = await getWatching(true);
  displayedList = fullList;
  computeStatsFromList(fullList);
  updateImages();
});

// Correction 1: Initialisation explicite du storage lors du chargement
window.addEventListener('load', function() {
  chrome.storage.local.get(null, function(items) {
    console.log('Current storage state:', items);
  });
});

// Fonction utilitaire pour débugger le storage
function debugStorage() {
  chrome.storage.local.get(null, function(items) {
    console.log('Current storage contents:', items);
  });
}

// Appelez cette fonction à des moments stratégiques, par exemple :
// - Après le login
// - Après la mise à jour des stats
// - Au chargement de la page

// Au début du fichier, après les console.log existants
chrome.storage.local.getBytesInUse(null, function(bytesInUse) {
  console.log('Storage bytes in use:', bytesInUse);
});

// Fonction pour réinitialiser le storage en cas de problème
function resetStorage() {
  chrome.storage.local.clear(function() {
    if (chrome.runtime.lastError) {
      console.error('Clear storage error:', chrome.runtime.lastError);
    } else {
      console.log('Storage cleared successfully');
      // Réinitialiser avec des valeurs par défaut
      chrome.storage.local.set({
        notificationsHistory: [],
        totalEpisodesWatched: 0,
        totalMinutesWatched: 0
      }, function() {
        console.log('Storage reinitialized');
        debugStorage(); // Afficher le nouveau contenu
      });
    }
  });
}

// Au début du fichier, après les imports
const DB_NAME = 'alta-storage';
const DB_VERSION = 5;
let db;

// Fonction pour initialiser IndexedDB
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
      
      // Store manga détaillé avec index des titres
      if (!db.objectStoreNames.contains('mangaList')) {
        const mangaStore = db.createObjectStore('mangaList', { keyPath: 'id' });
        
        // Indices pour les recherches rapides
        mangaStore.createIndex('mediaId', 'mediaId', { unique: false });
        mangaStore.createIndex('title', ['title.english'], { unique: false });
        mangaStore.createIndex('status', 'status', { unique: false });
        mangaStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
      
      // Store utilisateur
      if (!db.objectStoreNames.contains('userData')) {
        const userStore = db.createObjectStore('userData', { keyPath: 'id' });
        userStore.createIndex('lastLogin', 'lastLogin', { unique: false });
      }

      // Store anime détaillé
      if (!db.objectStoreNames.contains('animeList')) {
        const animeStore = db.createObjectStore('animeList', { keyPath: 'id' });
        
        // Indices pour les recherches rapides
        animeStore.createIndex('mediaId', 'mediaId', { unique: false });
        animeStore.createIndex('title', ['title.english'], { unique: false });
        animeStore.createIndex('status', 'status', { unique: false });
        animeStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        
        // Structure des données:
        /*
        {
          id: number,
          mediaId: number,
          progress: number,
          totalEpisodes: number,
          title: {
            english: string,
            native: string
          },
          coverImage: {
            medium: string,
            large: string,
            extraLarge: string
          },
          bannerImage: string,
          status: string,
          format: string,
          season: string,
          seasonYear: number,
          genres: string[],
          averageScore: number,
          popularity: number,
          nextAiringEpisode: {
            airingAt: number,
            timeUntilAiring: number,
            episode: number
          },
          lastUpdated: number,
          userStatus: string, // CURRENT, PLANNING, COMPLETED, etc.
          userScore: number,
          userStartDate: string,
          userCompletedDate: string,
          notes: string
        }
        */
      }

      // Store pour les notifications
      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        notifStore.createIndex('animeId', 'animeId', { unique: false });
        notifStore.createIndex('date', 'date', { unique: false });
        notifStore.createIndex('type', 'type', { unique: false });
      }

      // Store pour les statistiques
      if (!db.objectStoreNames.contains('stats')) {
        const statsStore = db.createObjectStore('stats', { keyPath: 'id' });
        statsStore.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

// Fonction pour sauvegarder dans IndexedDB
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

// Initialiser la DB au chargement
window.addEventListener('load', async function() {
  try {
    await initDB();
    console.log('IndexedDB ready to use');
    
    // Migrer les données existantes de chrome.storage.local vers IndexedDB
    chrome.storage.local.get(null, async function(items) {
      if (Object.keys(items).length > 0) {
        try {
          await saveToIndexedDB('userData', {
            id: 'user',
            token: items.token,
            userId: items.userId,
            type: items.type
          });
          
          await saveToIndexedDB('stats', {
            id: 'stats',
            totalEpisodesWatched: items.totalEpisodesWatched || 0,
            totalMinutesWatched: items.totalMinutesWatched || 0
          });
          
          if (items.notificationsHistory) {
            for (let notif of items.notificationsHistory) {
              await saveToIndexedDB('notifications', notif);
            }
          }
          
          console.log('Data migrated to IndexedDB successfully');
        } catch (err) {
          console.error('Error migrating data:', err);
        }
      }
    });
  } catch (err) {
    console.error('Failed to initialize IndexedDB:', err);
  }
});

// Modifier la fonction storeNotification pour inclure plus d'informations
function storeNotification(animeTitle, episodeNumber, animeId, coverImage) {
  chrome.storage.local.get(["notificationsHistory"], async function(result) {
    let history = result.notificationsHistory || [];
    const notif = {
      animeTitle: animeTitle,
      episodeNumber: episodeNumber,
      animeId: animeId,
      coverImage: coverImage,
      date: Date.now()
    };
    
    history.push(notif);
    
    // Sauvegarder dans chrome.storage.local et IndexedDB
    try {
      await saveToIndexedDB('notifications', notif);
      chrome.storage.local.set({ notificationsHistory: history });
      console.log("Notification saved to both storages");
    } catch (err) {
      console.error('Error saving notification:', err);
    }
  });
}

// Fonction pour récupérer depuis IndexedDB avec filtrage
async function getFromIndexedDB(type) {
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
  return media;
}

// Modifier saveMediaToIndexedDB pour utiliser le bon store selon le type
async function saveMediaToIndexedDB(mediaData, type) {
  try {
    const storeName = type === 'MANGA' ? 'mangaList' : 'animeList';
    
    if (mediaData.status !== 'CURRENT' && mediaData.status !== 'PAUSED') {
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
      await store.delete(mediaData.id);
      return null;
    }

    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    
    const enrichedData = {
      id: mediaData.id,
      mediaId: mediaData.mediaId,
      progress: mediaData.progress,
      totalCount: type === 'MANGA' ? mediaData.media?.chapters : mediaData.media?.episodes,
      title: {
        english: mediaData.media?.title?.english || null,
        native: mediaData.media?.title?.native || null
      },
      coverImage: {
        medium: mediaData.media?.coverImage?.medium || null,
        large: mediaData.media?.coverImage?.large || null,
        extraLarge: mediaData.media?.coverImage?.extraLarge || null
      },
      bannerImage: mediaData.media?.bannerImage || null,
      status: mediaData.status,
      format: mediaData.media?.format || null,
      season: mediaData.media?.season || null,
      seasonYear: mediaData.media?.seasonYear || null,
      genres: mediaData.media?.genres || [],
      averageScore: mediaData.media?.averageScore || null,
      popularity: mediaData.media?.popularity || null,
      nextAiringEpisode: mediaData.media?.nextAiringEpisode || null,
      lastUpdated: Date.now()
    };

    await store.put(enrichedData);
    console.log(`${type} saved/updated in IndexedDB:`, enrichedData);
    return enrichedData;
  } catch (err) {
    console.error(`Error saving ${type} to IndexedDB:`, err);
    throw err;
  }
}