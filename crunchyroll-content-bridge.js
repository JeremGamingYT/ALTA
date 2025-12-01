// ALTA - Content Bridge
// This script runs in the ISOLATED world (content script) to inject the interceptor and relay messages.

console.log('ALTA: Content bridge loading...');

// Inject the interceptor into the MAIN world
const s = document.createElement('script');
s.src = chrome.runtime.getURL('crunchyroll-interceptor.js');
s.onload = function () {
    this.remove();
    console.log('✅ ALTA: Interceptor script injected');
};
s.onerror = function (err) {
    console.error('❌ ALTA: Failed to inject interceptor', err);
};
(document.head || document.documentElement).appendChild(s);
console.log('ALTA: Injecting interceptor script...');

// Listen for messages from the interceptor
window.addEventListener('message', function (event) {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.source === 'ALTA_INTERCEPTOR' && event.data.action === 'WATCHLIST_DATA') {
        console.log('✅ ALTA: Received watchlist data from interceptor');
        console.log('  → Total items:', event.data.payload.total);
        console.log('  → Forwarding to background script...');

        chrome.runtime.sendMessage({
            action: 'WATCHLIST_SYNC',
            data: event.data.payload
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ ALTA: Error sending to background:', chrome.runtime.lastError);
            } else {
                console.log('✅ ALTA: Background script acknowledged:', response);
            }
        });
    }
});

console.log('✅ ALTA: Content bridge ready, listening for watchlist data...');
