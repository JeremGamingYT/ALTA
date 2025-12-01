// ALTA - Crunchyroll API Interceptor
// This script runs in the MAIN world (page context) to monkey-patch fetch.

(function () {
    console.log('ALTA: Initializing fetch interceptor...');

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');

            // Log all Crunchyroll API calls for debugging
            if (url.includes('crunchyroll.com') && url.includes('content/v2')) {
                console.log('ALTA: Crunchyroll API call detected:', url);
            }

            // Check if this is the watchlist API call
            // Pattern: content/v2/discover/{GUID}/watchlist
            if (url.includes('/watchlist') && url.includes('/content/v2/discover/')) {
                console.log('✅ ALTA: Intercepted Watchlist API call:', url);

                // Clone the response because the body can only be read once
                const clone = response.clone();

                clone.json().then(data => {
                    console.log('✅ ALTA: Captured watchlist data');
                    console.log('  → Total items:', data.total);
                    console.log('  → Data items:', data.data?.length || 0);

                    // Validate data structure
                    if (!data.data || !Array.isArray(data.data)) {
                        console.error('❌ ALTA: Invalid watchlist data structure', data);
                        return;
                    }

                    // Send to content script via window.postMessage
                    window.postMessage({
                        source: 'ALTA_INTERCEPTOR',
                        action: 'WATCHLIST_DATA',
                        payload: data
                    }, '*');

                    console.log('✅ ALTA: Watchlist data sent to content script');
                }).catch(err => {
                    console.error('❌ ALTA: Failed to parse watchlist JSON', err);
                });
            }
        } catch (err) {
            console.error('❌ ALTA: Error in fetch interceptor', err);
        }

        return response;
    };

    console.log('✅ ALTA: Fetch interceptor installed successfully');
    console.log('  → Watching for: /content/v2/discover/*/watchlist');
})();
