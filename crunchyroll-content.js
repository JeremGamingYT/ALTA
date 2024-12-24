(function() {
    console.log("Content script chargé sur :", window.location.href);
  
    var observer = new MutationObserver(function(mutations, obs) {
      var titleEl = document.querySelector('a.show-title-link h4');
      var episodeEl = document.querySelector('h1.title');
  
      if (titleEl && episodeEl) {
        var animeTitle = titleEl.textContent.trim();
        var epText = episodeEl.textContent.trim();
        // On s’attend à un format "E11 - Titre de l’épisode"
        var match = epText.match(/E(\d+)/i);
        var episodeNumber = match ? parseInt(match[1]) : null;
  
        console.log("CR-content: Titre =", animeTitle, " / Épisode =", episodeNumber);
  
        // Envoi d'un message au background
        chrome.runtime.sendMessage({
          action: "CRUNCHYROLL_EPISODE_FOUND",
          data: {
            animeTitle: animeTitle,
            episodeNumber: episodeNumber
          }
        }, function(response) {
          console.log("Réponse background:", response);
        });
  
        // On arrête d'observer (ou pas, si tu veux detecter un changement de page auto)
        obs.disconnect();
      }
    });
  
    observer.observe(document.body, { childList: true, subtree: true });
})();  