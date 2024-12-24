var storage = chrome.storage.local;
// Replace these values with your own AniList credentials
var token = "YOUR_TOKEN_HERE";
var userId = "YOUR_USER_ID";
const SERVICE_URL = "https://graphql.anilist.co";
const METHOD = "POST";
var headers = {
  "Authorization": "Bearer ",
  "Content-Type": "application/json",
  "Accept": "application/json"
};

chrome.runtime.onInstalled.addListener(function() {
  storage.get(["token", "userId"], function(result) {
    token = result.token || "";
    userId = result.userId || "";
    headers["Authorization"] = "Bearer " + token;
    console.log("Background initialized, token =", token, " userId =", userId);
  });
  chrome.alarms.create("checkAiringAlarm", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === "checkAiringAlarm") {
    checkAiring();
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "CRUNCHYROLL_EPISODE_FOUND") {
    console.log("BG: CRUNCHYROLL_EPISODE_FOUND received:", request.data);
    var animeTitle = request.data.animeTitle;
    var episodeNumber = request.data.episodeNumber;
    if (!animeTitle) {
      sendResponse({ status: "error", msg: "No animeTitle" });
      return true;
    }
    if (!token || !userId) {
      sendResponse({ status: "error", msg: "User not logged in" });
      return true;
    }
    searchAnime(animeTitle).then(function(animeId) {
      if (!animeId) {
        sendResponse({ status: "error", msg: "Anime not found" });
        return;
      }
      if (!episodeNumber || isNaN(episodeNumber)) {
        sendResponse({ status: "error", msg: "No valid episodeNumber" });
        return;
      }
      updateEpisode(animeId, episodeNumber).then(function(data) {
        console.log("BG: Episode updated =>", data);
        sendResponse({ status: "ok" });
      }).catch(function(err) {
        sendResponse({ status: "error", msg: err });
      });
    });
    return true;
  }
});

function checkAiring() {
  if (!token || !userId) return;
  getWatching().then(function(animeList) {
    if (!animeList || animeList.length === 0) return;
    animeList.forEach(async function(item) {
      let mediaId = item.mediaId;
      let data = await fetchNextAiring(mediaId);
      if (!data) return;
      if (data.nextAiringEpisode) {
        let timeUntil = data.nextAiringEpisode.timeUntilAiring;
        let epNumber = data.nextAiringEpisode.episode;
        if (timeUntil <= 0) {
          maybeNotify(item.media.title.romaji || item.media.title.english, epNumber);
        }
      }
    });
  });
}

function searchAnime(title) {
  let query = `
    query($search:String){
      Page(page:1, perPage:1){
        media(search:$search, type:ANIME){
          id
        }
      }
    }
  `;
  let variables = { search: title };
  return fetch(SERVICE_URL, getOptions(query, variables))
    .then(r => r.json())
    .then(json => {
      if (json.data && json.data.Page.media.length > 0) {
        return json.data.Page.media[0].id;
      }
      return null;
    })
    .catch(err => {
      console.error("Erreur searchAnime:", err);
      return null;
    });
}

function updateEpisode(mediaId, progress) {
  let query = `
    mutation($mediaId:Int,$progress:Int){
      SaveMediaListEntry(mediaId:$mediaId, progress:$progress){
        id
        progress
      }
    }
  `;
  let variables = { mediaId, progress };
  return fetch(SERVICE_URL, getOptions(query, variables))
    .then(r => r.json());
}

function getWatching() {
  let query = `
    query($userId:Int){
      MediaListCollection(userId:$userId, type:ANIME, status:CURRENT){
        lists {
          entries {
            id
            mediaId
            progress
            media {
              title {
                romaji
                english
              }
            }
          }
        }
      }
    }
  `;
  let variables = { userId: parseInt(userId) };
  return fetch(SERVICE_URL, getOptions(query, variables))
    .then(r => r.json())
    .then(json => {
      let lists = json.data.MediaListCollection.lists;
      if (!lists) return [];
      return lists.flatMap(l => l.entries);
    })
    .catch(err => {
      console.error("Erreur getWatching:", err);
      return [];
    });
}

function fetchNextAiring(mediaId) {
  let query = `
    query($id:Int){
      Media(id:$id, type:ANIME){
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
      }
    }
  `;
  let variables = { id: mediaId };
  return fetch(SERVICE_URL, getOptions(query, variables))
    .then(r => r.json())
    .then(json => json.data.Media)
    .catch(err => {
      console.error("Erreur fetchNextAiring:", err);
      return null;
    });
}

function maybeNotify(animeTitle, episodeNumber) {
    let storageKey = `notified_${animeTitle}_${episodeNumber}`;
    storage.get([storageKey], function(result) {
      if (result[storageKey]) {
        // On a déjà notifié => on ne fait rien
        return;
      }
      let notifId = `${animeTitle}-${episodeNumber}-${Date.now()}`;
      chrome.notifications.create(
        notifId,
        {
          type: "basic",
          iconUrl: "images/icon-48.png",
          title: "Nouvel épisode disponible !",
          message: `L'épisode ${episodeNumber} de ${animeTitle} est sorti !`,
          priority: 2
        },
        function() {
          storage.set({ [storageKey]: true });
          // On stocke dans l’historique
          storeNotification(animeTitle, episodeNumber);
        }
      );
    });
}

function storeNotification(animeTitle, episodeNumber) {
    // On récupère l’historique courant
    storage.get(["notificationsHistory"], function(result) {
      let history = result.notificationsHistory || [];
      // On ajoute un nouvel objet (date, anime, épisode…)
      history.push({
        animeTitle: animeTitle,
        episodeNumber: episodeNumber,
        date: Date.now() // timestamp
      });
      // On réenregistre
      storage.set({ notificationsHistory: history }, function() {
        console.log("Notification enregistrée dans l’historique.");
      });
    });
}

function getOptions(query, variables) {
  return {
    method: METHOD,
    headers: { ...headers, "Authorization": "Bearer " + token },
    body: JSON.stringify({ query, variables })
  };
}