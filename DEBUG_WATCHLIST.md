# Guide de Debug - Interception Watchlist

## Étape 1 : Vérifier que l'intercepteur est injecté

1. **Ouvrez votre watchlist Crunchyroll** : https://www.crunchyroll.com/watchlist
2. **Ouvrez DevTools** (F12)
3. **Allez dans l'onglet Console**
4. **Cherchez ce message** : 
   ```
   ALTA: Fetch interceptor installed.
   ```

✅ **Si vous voyez ce message** : L'intercepteur est bien injecté
❌ **Si vous ne voyez PAS ce message** : Problème d'injection (voir solutions ci-dessous)

## Étape 2 : Vérifier l'interception de l'API

1. **Actualisez la page watchlist** (F5)
2. **Dans la console DevTools**, cherchez :
   ```
   ALTA: Intercepted Watchlist API call: https://www.crunchyroll.com/content/v2/discover/.../watchlist...
   ALTA: Captured watchlist data, items: XXX
   ```

✅ **Si vous voyez ces messages** : L'API est bien interceptée !
❌ **Si vous ne voyez PAS ces messages** : L'API n'est pas appelée ou l'URL a changé

## Étape 3 : Vérifier le stockage

1. **Dans la console DevTools**, tapez :
   ```javascript
   chrome.storage.local.get('crunchyroll_watchlist', console.log)
   ```
2. **Regardez le résultat** :
   - Si vous voyez `{ crunchyroll_watchlist: { ... } }` → ✅ Les données sont stockées
   - Si vous voyez `{}` → ❌ Les données ne sont pas stockées

## Solutions aux Problèmes Courants

### ❌ Problème : "ALTA: Fetch interceptor installed" n'apparaît pas

**Solution 1 : Recharger l'extension**
1. Allez sur `chrome://extensions/`
2. Trouvez "ALTA - Crunchyroll + Anilist"
3. Cliquez sur le bouton ⟳ (Recharger)
4. Retournez sur la watchlist et actualisez (F5)

**Solution 2 : Vérifier les fichiers**
Assurez-vous que ces fichiers existent :
- ✅ `crunchyroll-interceptor.js`
- ✅ `crunchyroll-content-bridge.js`

### ❌ Problème : L'API n'est pas interceptée

**Vérification manuelle de l'URL de l'API** :

1. **Ouvrez DevTools → Onglet Network**
2. **Filtrez par "discover"**
3. **Actualisez la page watchlist**
4. **Cherchez une requête contenant** :
   - `/content/v2/discover/`
   - `/watchlist`

**Si l'URL est différente**, nous devons mettre à jour le pattern dans `crunchyroll-interceptor.js`

### ❌ Problème : Les données ne sont pas stockées

**Debug le bridge** :

Dans la console, tapez :
```javascript
window.addEventListener('message', (e) => {
  if (e.data.source === 'ALTA_INTERCEPTOR') {
    console.log('✅ Message reçu du interceptor:', e.data);
  }
});
```

Puis actualisez la page. Si vous voyez le message, le problème est dans le content-bridge.

## Test Complet - Checklist

| Étape | Vérification | Status |
|-------|-------------|--------|
| 1 | Extension chargée | ⬜ |
| 2 | Sur https://www.crunchyroll.com/watchlist | ⬜ |
| 3 | Console ouverte (F12) | ⬜ |
| 4 | Message "Fetch interceptor installed" visible | ⬜ |
| 5 | Page actualisée (F5) | ⬜ |
| 6 | Message "Intercepted Watchlist API call" visible | ⬜ |
| 7 | Message "Captured watchlist data, items: X" visible | ⬜ |
| 8 | `chrome.storage.local.get(...)` retourne des données | ⬜ |

Si toutes les cases sont cochées ✅, ouvrez le popup et essayez de synchroniser !

## Logs de Background

Pour voir les logs du background script :

1. **Allez sur** `chrome://extensions/`
2. **Trouvez** "ALTA - Crunchyroll + Anilist"
3. **Cliquez sur** "service worker" (ou "Afficher les vues")
4. **Une console DevTools s'ouvre** pour le background
5. **Cherchez** :
   ```
   ALTA: Processing watchlist with XXX items
   ALTA: Stored XXX watchlist items
   ```

## Commandes de Debug Utiles

```javascript
// Voir toutes les données stockées
chrome.storage.local.get(null, console.log)

// Voir uniquement la watchlist
chrome.storage.local.get('crunchyroll_watchlist', console.log)

// Vider le cache (ATTENTION : efface tout)
chrome.storage.local.clear(() => console.log('Storage cleared'))

// Tester l'envoi manuel de sync
chrome.runtime.sendMessage({action: 'START_WATCHLIST_SYNC'}, console.log)
```

---

**Besoin d'aide ?** Copiez-collez les messages de la console dans votre rapport de bug !
