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
  chrome.identity.launchWebAuthFlow({ url: webAuthUrl, interactive: true }, function(redirectUrl) {
    let access_token = redirectUrl.match(/\#(?:access_token)\=([\S\s]*?)\&/)[1];
    token = access_token;
    storage.set({ [NAMESPACES.token]: token });
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
          storage.set({ [NAMESPACES.userId]: userId });
          logIn.style.display = "none";
          logOut.style.display = "";
          refreshList();
        })
        .catch(handleError);
    }
  });
});

logOut.addEventListener("click", function() {
  storage.set({ [NAMESPACES.token]: "", [NAMESPACES.userId]: "" });
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
          mediaList(userId:$userId, type:ANIME, status_in:[CURRENT,COMPLETED]){
            id
            progress
            media {
              id
              episodes
              title {
                romaji
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
  chrome.storage.local.set({
    totalEpisodesWatched: totalProgress,
    totalMinutesWatched: totalTime
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

  /*
    Si tu veux inclure aussi les animes terminés dans la liste,
    tu peux changer "status: CURRENT" en "status_in: [CURRENT, COMPLETED]"

    query($userId:Int){
      MediaListCollection(userId:$userId, type:ANIME, status_in:[CURRENT,COMPLETED], sort:UPDATED_TIME){
        ...
      }
    }
  */

  let query = `
    query($userId:Int){
      MediaListCollection(userId:$userId, type:ANIME, status_in:[CURRENT, PAUSED], sort:UPDATED_TIME){
        lists {
          entries {
            id
            mediaId
            progress
            media {
              ${format}
              status
              title {
                romaji
                english
              }
              coverImage {
                medium
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
        console.error("Erreur fetch direct getWatching:", e);
        return null;
      });
    if (!res || !res.data || !res.data.MediaListCollection) {
      console.log("Aucune liste trouvée ou data manquante =>", res);
      return [];
    }
    if (!res.data.MediaListCollection.lists || res.data.MediaListCollection.lists.length === 0) {
      return [];
    }
    return res.data.MediaListCollection.lists[0].entries || [];
  }

  let cacheKey = `watching_${userId}_${type}`;
  let json = await fetchWithCache(cacheKey, query, variables, 600).catch(e => {
    console.error("Erreur fetchWithCache getWatching:", e);
    return null;
  });
  if (!json || !json.data || !json.data.MediaListCollection) {
    console.log("Pas de data =>", json);
    return [];
  }
  let lists = json.data.MediaListCollection.lists;
  if (!lists || !lists[0]) return [];
  return lists[0].entries || [];
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

  // On construit un "cell" par anime
  for (let i = displayedList.length - 1; i >= 0; i--) {
    let mediaList = displayedList[i];
    
    // On crée un conteneur .cell
    let cellDiv = document.createElement("div");
    cellDiv.className = "cell";

    // Construire l’HTML interne
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
          title="${mediaList.media.title.romaji || mediaList.media.title.english}"
        />
      </a>
    `;
    let decrement = `
      <button
        id="dec-${mediaList.id}"
        style="float:left;"
        height="1"
        width="1"
      >-</button>
    `;
    let text = `
      <span id="prog-${mediaList.id}">${mediaList.progress}/${totalEpisodes || "?"}</span>
    `;
    let increment = `
      <button
        id="inc-${mediaList.id}"
        style="float:right;"
        height="1"
        width="1"
      >+</button>
    `;
    let span = `<div class="centerText">${decrement} ${text} ${increment}</div>`;

    // On assemble
    cellDiv.innerHTML = imgHtmlString + span;

    // On ajoute la div .cell dans #display
    display.appendChild(cellDiv);
  }

  // Maintenant qu’on a ajouté toutes les cells, on place les listeners +/-
  for (let i = displayedList.length - 1; i >= 0; i--) {
    let mediaList = displayedList[i];
    doc.getElementById(`dec-${mediaList.id}`).addEventListener("click", mediaClick(mediaList, -1));
    doc.getElementById(`inc-${mediaList.id}`).addEventListener("click", mediaClick(mediaList, 1));
  }
}

// ================== MEDIA CLICK ===================
const clickTimers = {};

function mediaClick(mediaList, i) {
  return function(e) {
    clearTimeout(clickTimers[mediaList.id]);

    const newProgress = mediaList.progress + i;
    const query = `
      mutation($id:Int,$progress:Int){
        SaveMediaListEntry(id:$id, progress:$progress){
          id
          progress
        }
      }
    `;
    const variables = {
      id: mediaList.id,
      progress: newProgress
    };

    clickTimers[mediaList.id] = setTimeout(() => {
      fetch(SERVICE_URL, getOptions(query, variables))
        .then(res => res.json())
        .then(json => {
          if (json.errors) {
            console.error("AniList GraphQL Errors =>", json.errors);
            return;
          }
          if (!json.data || !json.data.SaveMediaListEntry) {
            console.error("SaveMediaListEntry est null =>", json);
            return;
          }

          mediaList.progress = json.data.SaveMediaListEntry.progress;

          let total = (displayedType === "MANGA")
            ? (mediaList.media.chapters || "")
            : (mediaList.media.episodes || "");

          doc.getElementById(`prog-${mediaList.id}`).innerText = 
            `${mediaList.progress}/${total || "?"}`;

          if (i > 0) {
            updateStats(i);
          }

          // refreshList();
        })
        .catch(handleError);
    }, 300);
  };
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
  storage.set({ [NAMESPACES.type]: displayedType });
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
      let romaji = item.media.title.romaji || "";
      let english = item.media.title.english || "";
      return (
        romaji.toUpperCase().includes(query) ||
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
storage.get([NAMESPACES.token, NAMESPACES.userId, NAMESPACES.type], async function(result) {
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