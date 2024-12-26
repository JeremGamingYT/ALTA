# ALTA - AniList Track Assistant 🎬

<div align="center">

![ALTA Logo](images/icon-64.png)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ggjlaakenonjlionbnebgbje?style=for-the-badge)](https://github.com/JeremGamingYT/ALTA)
[![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JeremGamingYT/ALTA)

*Automatically track your anime progress on AniList while you watch!*

**Current Version: 1.12**

</div>

### 🆕 What's New in 1.12

- 🎨 **Enhanced Status Menu**: Added colorful icons and improved visual design
- 🖱️ **Better Interaction**: Improved button layout and click feedback
- 💅 **Visual Polish**: Enhanced spacing and alignment in status dropdown
- 🎯 **Status Indicators**: Clear visual feedback for current status
- ⚡ **UI Improvements**: Smoother transitions and better accessibility

### 🆕 What's New in 1.11

- 🔄 **Enhanced Sync System**: Improved episode detection and progress tracking
- 📚 **Manga Support**: Switch between anime and manga tracking
- 💾 **IndexedDB Integration**: Better offline support and data persistence
- 🎯 **Smart Caching**: Optimized data storage with automatic cache refresh
- 🔍 **Debug Mode**: Added detailed logging for troubleshooting
- 🛠️ **Status Management**: Right-click menu for quick status updates
- ⚡ **Performance Boost**: Faster loading times and smoother animations
- 🎨 **UI Polish**: Enhanced visual feedback and transitions

## ✨ Features

- 🔄 **Automatic Progress Tracking**: Updates your AniList progress in real-time while watching
- 🎯 **Smart Detection**: Automatically identifies the anime you're watching
- 📊 **Enhanced Statistics**: View your global anime statistics including total episodes watched and mean scores
- 🔔 **Notifications System**: Track your recent updates and activities
- 🔒 **Secure Authentication**: Safe and secure connection with your AniList account
- 🌐 **Cross-Platform**: Coming to Chrome Web Store in 2025
- 🎨 **Clean Interface**: Simple and intuitive user interface with improved UI/UX
- 📱 **Responsive Design**: Better button spacing and visual improvements
- 💾 **Enhanced Storage**: Robust local storage using IndexedDB
- ⚡ **Improved Performance**: Better caching and data management
- 📊 **Extended Metadata**: More detailed anime information tracking
- 🔍 **Debug Tools**: Improved logging and troubleshooting capabilities
- 📚 **Dual Tracking**: Track both anime and manga progress
- 🔄 **Format Switching**: Easily switch between anime and manga lists
- 💾 **Enhanced Storage**: Separate storage for anime and manga data

## 🚀 Installation

### Chrome (Manual Installation)
1. Download the latest release from GitHub
2. Enable Developer mode in Chrome extensions
3. Click "Load unpacked" and select the downloaded folder

> 📝 Note: ALTA will be available on the Chrome Web Store in 2025! Until then, please use the manual installation method.

## 💻 Development Setup

1. Clone the repository
2. Copy `config.example.js` to a new file named `background.js`
3. Enable Developer mode in your browser's extension settings
4. Set up your AniList API client:
   - Go to [AniList Developer Settings](https://anilist.co/settings/developer)
   - Create a new client
   - Set redirect URL to: `https://[YOUR-EXTENSION-ID].chromiumapp.org/`
   - Copy your Client ID to `data.js`
5. Update `background.js` with your AniList credentials
6. Load the unpacked extension

⚠️ **Security Note**: Never commit your personal AniList credentials to the repository. The files containing sensitive information (`background.js` and `data.js`) are already in `.gitignore`.

## 🛠️ Usage

1. Click the ALTA icon in your browser toolbar
2. Log in with your AniList account
3. Start watching on supported platforms
4. ALTA will automatically update your progress!
5. Access global stats and notifications through the toolbar icons

## 🙏 Acknowledgments

- AniList for providing the API
- All contributors and users who helped improve ALTA
- The anime community for their continued support

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ for the anime community
</div>
