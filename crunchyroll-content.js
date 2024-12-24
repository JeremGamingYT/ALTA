(function() {
    let lastTitle = null;
    let lastEpisode = null;
  
    const observer = new MutationObserver(checkForChanges);
    observer.observe(document.body, { childList: true, subtree: true });
  
    function checkForChanges() {
      const titleEl = document.querySelector('a.show-title-link h4');
      const episodeEl = document.querySelector('h1.title');
      if (!titleEl || !episodeEl) return;
  
      const animeTitle = titleEl.textContent.trim();
      const epText = episodeEl.textContent.trim();
      const match = epText.match(/E(\d+)/i);
      const episodeNumber = match ? parseInt(match[1]) : null;
  
      if (animeTitle === lastTitle && episodeNumber === lastEpisode) return;
  
      lastTitle = animeTitle;
      lastEpisode = episodeNumber;
  
      chrome.runtime.sendMessage({
        action: "CRUNCHYROLL_EPISODE_FOUND",
        data: {
          animeTitle: animeTitle,
          episodeNumber: episodeNumber
        }
      }, function(response) {
        console.log("Réponse background:", response);
      });
    }
  
    console.log("Content script => mutation observer actif.");
})();  