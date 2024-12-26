# ALTA - AniList Track Assistant 🎬

<div align="center">

![ALTA Logo](images/icon-64.png)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ggjlaakenonjlionbnebgbje?style=for-the-badge)](https://github.com/JeremGamingYT/ALTA)
[![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JeremGamingYT/ALTA)

*Automatically track your anime progress on AniList while you watch!*

**Current Version: 1.12**

</div>

### 🆕 What's New in 1.12

- 🎨 **Enhanced Status Menu**: Colorful icons, improved visual design
- 🖱️ **Better Interaction**: Improved button layout, click feedback
- 💅 **Visual Polish**: Enhanced spacing and alignment in status dropdown
- 🎯 **Status Indicators**: Clear visual feedback for current status
- ⚡ **UI Improvements**: Smoother transitions and better accessibility

## ✨ Core Features

- 🔄 **Real-Time Progress Tracking**: Updates your AniList activity as you watch.
- 🎯 **Intelligent Detection**: Automatically identifies the anime being viewed.
- 📊 **Detailed Statistics**: Access your total watch history and mean scores.
- 🔔 **Notifications**: Stay updated with activity alerts.
- 🔒 **Secure Login**: Safely connect your AniList account.
- 🌐 **Cross-Platform Ready**: Available on Chrome/Edge/Opera/Brave (web store coming in 2025).
- 🎨 **User-Friendly Interface**: Sleek design with intuitive navigation.
- 📱 **Responsive Design**: Optimized for all device sizes.
- 💾 **Advanced Storage**: Uses IndexedDB for robust local data storage.
- ⚡ **Performance Boost**: Improved caching and faster data handling.
- 📊 **Richer Metadata**: Comprehensive anime details.
- 🔍 **Debug Tools**: Enhanced error tracking and logs.
- 📚 **Dual Tracking**: Tracks both anime and manga.
- 🔄 **Format Switching**: Switch seamlessly between anime and manga lists.

## 🚀 Installation

### Chrome (Manual Installation)
1. Download the latest release from GitHub
2. Enable “Developer mode” in your Chrome Extensions settings.
3. Select “Load unpacked” and upload the downloaded folder.

> 📝 Note: ALTA will be officially available on the Chrome Web Store in 2025. For now, manual installation is required.

## 💻 Development Setup

1. Clone the GitHub repository.
2. Rename config.example.js to background.js.
3. Activate “Developer mode” in your browser’s extension settings.
4. Set up your AniList API client:
   - Navigate to [AniList Developer Settings](https://anilist.co/settings/developer)
   - Create a new client and set the redirect URL: `https://[YOUR-EXTENSION-ID].chromiumapp.org/`.
   - Copy your Client ID to `data.js`
5.	Update `background.js` with AniList credentials.
6.	Load the unpacked extension in your browser.

⚠️ **Security Tip**: Never commit personal AniList credentials to the repository. Sensitive files (`background.js` and `data.js`) are included in `.gitignore` for protection.

## 🛠️ Using ALTA

1. Launch ALTA via the browser toolbar icon.
2. Log in with your AniList credentials.
3. Start streaming on supported platforms.
4. ALTA will sync your progress automatically!
5. Explore stats and notifications using the toolbar options.

## 🙏 Acknowledgments

- Special thanks to AniList for their API, contributors, and the passionate anime community for their support!

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ for the anime community/Fans!
</div>
