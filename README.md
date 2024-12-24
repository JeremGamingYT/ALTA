# ALTA - AniList Track Assistant 🎬

<div align="center">

![ALTA Logo](images/icon-32.png)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ggjlaakenonjlionbnebgbje?style=for-the-badge)](https://github.com/JeremGamingYT/ALTA)
[![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JeremGamingYT/ALTA)

*Automatically track your anime progress on AniList while you watch!*

**Current Version: 1.1**

</div>

## ✨ Features

- 🔄 **Automatic Progress Tracking**: Updates your AniList progress in real-time while watching
- 🎯 **Smart Detection**: Automatically identifies the anime you're watching
- 📊 **Enhanced Statistics**: View your global anime statistics including total episodes watched and mean scores
- 🔔 **Notifications System**: Track your recent updates and activities
- 🔒 **Secure Authentication**: Safe and secure connection with your AniList account
- 🌐 **Cross-Platform**: Available for both Chrome and Firefox
- 🎨 **Clean Interface**: Simple and intuitive user interface with improved UI/UX
- 📱 **Responsive Design**: Better button spacing and visual improvements

## 🚀 Installation

### Chrome
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore/detail/ggjlaakenonjlionbnebgbje/)
2. Click "Add to Chrome"
3. Follow the authentication process with your AniList account

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

## 🆕 What's New in 1.1

- Added global statistics view with total episodes, mean scores, and more
- Implemented notifications system to track recent updates
- Improved UI with better button spacing and visual enhancements
- Enhanced error handling and API response management
- Better caching system for improved performance
- Support for both current and paused anime in lists

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
