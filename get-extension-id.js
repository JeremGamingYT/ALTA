// Get Extension ID Helper
// This script will log the extension ID and the redirect URL to the console
// Open the popup, then press F12 to see the console

console.log('='.repeat(60));
console.log('ALTA Extension Configuration');
console.log('='.repeat(60));
console.log('Extension ID:', chrome.runtime.id);
console.log('Redirect URL:', chrome.identity.getRedirectURL());
console.log('='.repeat(60));
console.log('Copy the Redirect URL above and paste it in your AniList Developer settings');
console.log('URL: https://anilist.co/settings/developer');
console.log('='.repeat(60));
