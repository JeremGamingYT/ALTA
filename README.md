# ALTA - AniList Track Assistant 🎬

<div align="center">

![ALTA Logo](icons/icon128.png)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ggjlaakenonjlionbnebgbje?style=for-the-badge)](https://chrome.google.com/webstore/detail/ggjlaakenonjlionbnebgbje/)
[![Firefox Add-ons](https://img.shields.io/amo/v/unofficial-anilist-updater?style=for-the-badge)](https://addons.mozilla.org/en-US/firefox/addon/unofficial-anilist-updater/)
[![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-username/ALTA)

*Automatically track your anime progress on AniList while you watch!*

</div>

## ✨ Features

- 🔄 **Automatic Progress Tracking**: Updates your AniList progress in real-time while watching
- 🎯 **Smart Detection**: Automatically identifies the anime you're watching
- 🔒 **Secure Authentication**: Safe and secure connection with your AniList account
- 🌐 **Cross-Platform**: Available for both Chrome and Firefox
- 🎨 **Clean Interface**: Simple and intuitive user interface

## 🚀 Installation

### Chrome
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore/detail/ggjlaakenonjlionbnebgbje/)
2. Click "Add to Chrome"
3. Follow the authentication process with your AniList account

### Firefox
1. Visit [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/unofficial-anilist-updater/)
2. Click "Add to Firefox"
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

## 🙏 Acknowledgments

This project is an enhanced version of the [Unofficial AniList Updater](https://github.com/bm-khan/Unofficial-Anilist-Updater) by bm-khan.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ for the anime community
</div>
