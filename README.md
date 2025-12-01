# 🎬 ALTA - Crunchyroll + AniList Extension

Extension Chrome pour synchroniser automatiquement votre progression Crunchyroll avec AniList.

## ✨ Nouvelles Fonctionnalités (v1.11+)

### 🔄 Synchronisation Watchlist Crunchyroll
- **Interception automatique** de l'API watchlist Crunchyroll
- **Détection intelligente** du progrès réel (épisode regardé vs. à regarder)
- **Synchronisation progressive** avec rate-limiting (2s entre requêtes)
- **Interface moderne** avec suivi en temps réel
- **Cache intelligent** pour éviter les requêtes répétées

## 🚀 Installation

1. **Clonez le repo** ou téléchargez les fichiers
2. **Ouvrez Chrome** et allez sur `chrome://extensions/`
3. **Activez le mode développeur** (en haut à droite)
4. **Cliquez sur "Charger l'extension non empaquetée"**
5. **Sélectionnez** le dossier du projet

## 🎮 Utilisation

### Configuration Initiale
1. Cliquez sur l'icône ALTA dans la barre d'outils
2. Cliquez sur "Log In" pour vous connecter à AniList
3. Autorisez l'extension

### Synchronisation Manuelle (Épisode par Épisode)
- Regardez un anime sur Crunchyroll
- L'extension détectera automatiquement votre progression
- Cliquez sur +/- dans le popup pour ajuster manuellement

### 🆕 Synchronisation Watchlist (NOUVEAU !)

#### Méthode 1 : Automatique
1. **Visitez** votre watchlist Crunchyroll : https://www.crunchyroll.com/watchlist
2. **Attendez** que la page charge complètement
3. **Ouvrez** le popup ALTA
4. **Cliquez** sur l'icône 🔄 (Watchlist Sync)
5. Les données sont automatiquement capturées !

#### Méthode 2 : Manuelle
1. **Ouvrez** le popup ALTA
2. **Cliquez** sur l'icône 🔄
3. **Cliquez** sur "Synchroniser Maintenant"
4. **Observez** la barre de progression en temps réel

## 🐛 Dépannage

### "No watchlist data available"

Cette erreur signifie que l'extension n'a pas encore capturé les données de votre watchlist.

**Solution rapide** :
1. Allez sur https://www.crunchyroll.com/watchlist
2. Attendez que la page charge complètement
3. Actualisez la page (F5) si nécessaire
4. Retournez au popup et réessayez

**Debug complet** : Consultez [DEBUG_WATCHLIST.md](./DEBUG_WATCHLIST.md)

### Vérifier que l'interception fonctionne

1. Ouvrez https://www.crunchyroll.com/watchlist
2. Ouvrez DevTools (F12) → Console
3. Cherchez ces messages :
   ```
   ✅ ALTA: Fetch interceptor installed successfully
   ✅ ALTA: Intercepted Watchlist API call: ...
   ✅ ALTA: Captured watchlist data
   ```

Si vous ne voyez PAS ces messages, rechargez l'extension :
1. `chrome://extensions/`
2. Trouvez ALTA
3. Cliquez sur ⟳ (Recharger)

## 📊 Fonctionnalités

- ✅ Connexion AniList OAuth
- ✅ Détection automatique des épisodes regardés
- ✅ Mise à jour manuelle du progrès (+/-)
- ✅ Notifications pour nouveaux épisodes
- ✅ Statistiques de visionnage
- ✅ **NOUVEAU** : Sync complète de la watchlist Crunchyroll
- ✅ **NOUVEAU** : Rate-limiting intelligent
- ✅ **NOUVEAU** : Cache de mapping Crunchyroll ↔ AniList

## 🔧 Configuration

### Fichier `data.js`
Créez un fichier `data.js` basé sur `data.js.example` :

```javascript
const clientData = {
  clientId: "VOTRE_CLIENT_ID_ANILIST"
};
```

Obtenez votre Client ID sur : https://anilist.co/settings/developer

## 📁 Structure du Projet

```
ALTA/
├── manifest.json                    # Configuration de l'extension
├── background.js                    # Service worker (sync logic)
├── popup.html/js/css               # Interface utilisateur
├── crunchyroll-interceptor.js      # Interception API watchlist
├── crunchyroll-content-bridge.js   # Bridge pour messages
├── crunchyroll-content.js          # Détection épisodes
├── data.js                         # Configuration OAuth
└── DEBUG_WATCHLIST.md              # Guide de dépannage
```

## 🛠️ Technologies

- **Manifest V3** (Chrome Extensions)
- **AniList GraphQL API**
- **Crunchyroll Internal API** (interception)
- **IndexedDB** pour le cache local
- **Chrome Storage API**

## 📝 Notes Importantes

### Rate Limiting
L'extension respecte les limites de l'API AniList :
- **2 secondes** entre chaque requête de sync
- **Max ~30 requêtes/minute** (limite AniList : 90/min)

### Cache
Le cache de mapping Crunchyroll → AniList est stocké indéfiniment pour éviter les recherches répétées.

Pour vider le cache :
```javascript
chrome.storage.local.remove('anilist_search_cache')
```

### Données Personnelles
L'extension stocke uniquement :
- Votre token AniList (localement)
- Le mapping des animes
- Votre watchlist Crunchyroll (localement)

**Aucune donnée n'est envoyée à des serveurs tiers.**

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📜 Licence

Voir le fichier [LICENSE](./LICENSE)

## 🙏 Crédits

- **AniList** pour l'API GraphQL
- **Crunchyroll** (interception non officielle)
- **Font Awesome** pour les icônes

---

**Auteur** : JeremGaming  
**Version** : 1.11+  
**Dernière mise à jour** : 2025-11-30
