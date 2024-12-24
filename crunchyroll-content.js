(function() {
    console.log("Content script chargé sur :", window.location.href);
  
    var observer = new MutationObserver(function(mutations, obs) {
      var titleEl = document.querySelector('a.show-title-link h4');
      var episodeEl = document.querySelector('h1.title');
  
      if (titleEl && episodeEl) {
        var animeTitle = titleEl.textContent.trim();
        // On s’attend à un format du style : "E11 - La réincarnation de la déesse"
        // On va donc extraire "11" avec un petit RegEx
        var epText = episodeEl.textContent.trim(); 
        var match = epText.match(/E(\d+)/i);
        var episodeNumber = match ? parseInt(match[1]) : null;
  
        console.log("Titre détecté :", animeTitle);
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