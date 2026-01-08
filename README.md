# 🎮 Hypixel Ban Checker

A modern desktop application for checking Hypixel ban status using session tokens with built-in proxy management.

[App Screenshot] https://imgur.com/a/ZPHvB5d 

## ✨ Features

- ✅ **Session Token Validation** - Check ban status instantly
- ✅ **Built-in Proxy Manager** - Scrape, test, and manage proxies
- ✅ **Auto Proxy Rotation** - Automatically cycle through working proxies
- ✅ **Real-time Testing** - Live progress bars and stats
- ✅ **Import/Export** - Save and load proxy lists
- ✅ **Modern Dark UI** - Beautiful Electron-based interface
- ✅ **Speed Sorting** - Automatically sorts proxies by speed

---

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **Python** (v3.7 or higher) - [Download here](https://www.python.org/)
3. **Git** (optional) - [Download here](https://git-scm.com/)

---

## 🚀 Quick Start

### Step 1: Download the Project

**Option A: Clone with Git**
```bash
git clone c
cd hypixel-checker
```

**Option B: Download ZIP**
- Download the ZIP file
- Extract it
- Open the folder in your terminal

---

### Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

**What this installs:**
- `minecraft` - Minecraft protocol library
- `requests` - HTTP requests
- `colorama` - Colored console output
- `cryptography` - Secure connections

---

### Step 3: Install Node.js Dependencies

```bash
npm install
```

**What this installs:**
- `electron` - Desktop app framework
- `axios` - HTTP client for proxy management
- Other required packages

---

### Step 4: Run the Application

```bash
npm start
```

The app will launch in a new window!

---

## 📖 How to Use

### Token Checker

1. Switch to the **"Token Checker"** tab
2. Paste your session token (starts with `eyJ...`)
3. Select proxy option:
   - **None** - Direct connection
   - **Auto Rotate** - Automatically use working proxies
   - **HTTP/SOCKS5** - Manual proxy type
4. Click **"CHECK TOKEN"**

### Proxy Manager

1. Switch to the **"Proxy Manager"** tab
2. Click **"🌐 Scrape Proxies"** to fetch free proxies
3. Select proxy type (All/HTTP/SOCKS4/SOCKS5)
4. Click **"✓ Test All"** to test proxies
5. View stats: Total, Alive, Dead, Avg Speed
6. Use **"Auto Rotate"** in Token Checker to use them

---

## 🛠️ Building for Distribution

### Build for Windows:
```bash
npm run build
```

The installer will be in the `dist/` folder.

### Build for macOS:
```bash
npm run build
```

### Build for Linux:
```bash
npm run build
```

---

## 📁 Project Structure

```
hypixel-checker/
│
├── python/
│   └── checker.py          # Python ban checking logic
│
├── index.html              # Main UI structure
├── styles.css              # Styling
├── renderer.js             # Frontend logic
├── main.js                 # Electron main process
├── preload.js              # Electron preload script
├── proxy-manager.js        # Proxy management system
│
├── package.json            # Node.js dependencies
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

---

## ⚙️ Configuration

### Proxy Sources

Edit `proxy-manager.js` to add/remove proxy sources:

```javascript
const sources = {
    http: [
        'https://api.proxyscrape.com/...',
        // Add more sources here
    ],
    // ...
};
```

### Testing Concurrency

Adjust concurrent proxy testing in `main.js`:

```javascript
const results = await proxyManager.testAllProxies(10, ...); // Change 10 to desired concurrency
```

---

## 🐛 Troubleshooting

### "Python not found"
- Make sure Python is installed and in your PATH
- Try `python --version` or `python3 --version`

### "Module not found: minecraft"
- Run `pip install -r requirements.txt` again
- Try `pip3` instead of `pip`

### "npm install failed"
- Delete `node_modules` folder
- Delete `package-lock.json`
- Run `npm install` again

### Proxies not working
- Some free proxies are unreliable
- Try scraping multiple times
- Import your own proxy list

---

## 🔒 Security Notes

- **Never share your session tokens** - They provide full account access
- **Use proxies carefully** - Some may log your data
- **This is for educational purposes** - Use responsibly

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🤝 Contributing

Pull requests are welcome! For major changes:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## ⭐ Credits

- **Minecraft Protocol** - [minecraft-python](https://github.com/ammaraskar/pyCraft)
- **Proxy Sources** - Various free proxy providers
- **UI Theme** - Catppuccin-inspired dark theme

---
