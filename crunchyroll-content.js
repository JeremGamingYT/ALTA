(function() {
    console.log("Content script chargé sur cette page :", window.location.href);
  
    var observer = new MutationObserver(function(mutations, obs) {
      var el = document.querySelector('a.show-title-link h4');
      if (el) {
        var animeTitle = el.textContent.trim();
        console.log("Titre détecté :", animeTitle);
  
        var url = window.location.href;
        var episodeMatch = url.match(/episode-(\d+)/i);
        var episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : null;
        console.log("Épisode détecté :", episodeNumber);
  
        chrome.runtime.sendMessage({
          action: "CRUNCHYROLL_EPISODE_FOUND",
          data: {
            animeTitle: animeTitle,
            episodeNumber: episodeNumber
          }
        }, function(response) {
          if (response && response.status === "ok") {
            console.log("Message background : succès.");
          } else {
            console.log("Message background : erreur ou aucune réponse :", response);
          }
        });
  
        obs.disconnect();
      }
    });
  
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
})();  