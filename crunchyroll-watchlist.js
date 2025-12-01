// ALTA - Crunchyroll Watchlist Scraper

(function () {
    console.log('ALTA Watchlist Scraper loaded');

    let processedCards = new Set();
    let debounceTimer = null;

    // Observer to handle dynamic loading
    const observer = new MutationObserver((mutations) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanWatchlist, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function scanWatchlist() {
        const cards = document.querySelectorAll('div[data-t="watch-list-card"]');
        console.log(`ALTA: Found ${cards.length} watchlist cards`);

        cards.forEach(card => {
            // Avoid re-processing if we could track unique IDs, but for now we just parse
            // We can use the link href as a unique key if needed, but let's just parse first.

            const link = card.querySelector('a.watchlist-card__content-link--Ujiaq') || card.querySelector('a[data-t="watch-list-card"]');
            // The user specified class 'watchlist-card__content-link--Ujiaq' but noted it might change.
            // The HTML shows the link is the first <a> child of the card usually, or has specific class.
            // Let's try to find the <a> with aria-label inside the card.
            const targetLink = card.querySelector('a[aria-label]');

            if (!targetLink) return;

            const ariaLabel = targetLink.getAttribute('aria-label');
            if (!ariaLabel) return;

            const data = parseAriaLabel(ariaLabel);
            if (data) {
                // Send to background
                // We might want to debounce this or check if it's already synced
                // For now, let's send it. The background script should handle duplicates or no-ops if progress is same.
                chrome.runtime.sendMessage({
                    action: 'updateAnime',
                    data: {
                        title: data.title,
                        episodeNumber: data.progress,
                        // We don't have mediaId here easily unless we scrape it from href or API
                        // The background script handles title search.
                    }
                });
            }
        });
    }

    function parseAriaLabel(text) {
        // French Patterns
        // "À suivre Épisode 14 de Let This Grieving Soul Retire" -> 13
        // "Reprendre Épisode 2 de Li'l Miss Vampire Can't Suck Right" -> 1
        // "Lecture Épisode 1 de SPY x FAMILY" -> 0
        // "Regarder à nouveau Épisode 10 de May I Ask for One Final Thing?" -> 10

        // Regex for "Next/Continue/Start" (Offset -1)
        // Matches: "À suivre", "Reprendre", "Lecture" followed by optional "Saison X" then "Épisode Y" then "de Title"
        const frNextRegex = /^(?:À suivre|Reprendre|Lecture)\s+(?:Saison\s+\d+\s+)?Épisode\s+(\d+)\s+de\s+(.+)$/i;

        // Regex for "Rewatch" (Offset 0)
        const frRewatchRegex = /^(?:Regarder à nouveau)\s+(?:Saison\s+\d+\s+)?Épisode\s+(\d+)\s+de\s+(.+)$/i;

        // English Patterns (Assumed)
        const enNextRegex = /^(?:Up Next|Continue Watching|Start Watching)\s+(?:Season\s+\d+\s+)?Episode\s+(\d+)\s+of\s+(.+)$/i;
        const enRewatchRegex = /^(?:Watch Again)\s+(?:Season\s+\d+\s+)?Episode\s+(\d+)\s+of\s+(.+)$/i;

        let match;

        // French Next
        if ((match = text.match(frNextRegex))) {
            return {
                progress: parseInt(match[1]) - 1,
                title: match[2].trim()
            };
        }

        // French Rewatch
        if ((match = text.match(frRewatchRegex))) {
            return {
                progress: parseInt(match[1]),
                title: match[2].trim()
            };
        }

        // English Next
        if ((match = text.match(enNextRegex))) {
            return {
                progress: parseInt(match[1]) - 1,
                title: match[2].trim()
            };
        }

        // English Rewatch
        if ((match = text.match(enRewatchRegex))) {
            return {
                progress: parseInt(match[1]),
                title: match[2].trim()
            };
        }

        return null;
    }

})();
