# Chess Arrows Extension

Show engine analysis with arrow visualizations on chess websites like Lichess and Chess.com, powered by Leela Chess Zero (LC0) and Maia Chess.

## Features

- 🎯 Visual arrow indicators for best moves and alternatives
- 📊 Real-time position evaluation display
- 🔄 Automatic analysis updates as you play
- 🎨 Customizable arrow colors and styles
- 🧠 Powered by LC0 engine with Maia weights
- ♟️ Works on Lichess and Chess.com

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Leela Chess Zero (LC0)](https://lczero.org/play/download/)
- [Maia Chess weights](https://github.com/CSSLab/maia-chess)

## Installation

### 1. Extension Setup

The extension files are already set up in this folder. The structure includes:
```
chess-arrows-extension/
├── images/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── chess-arrows-host/
│   ├── lc0_connector.js
│   ├── manifest.json
│   └── package.json
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── content.js
├── engine.js
└── styles.css
```

### 2. Native Messaging Host Setup

1. Install dependencies:
```powershell
cd chess-arrows-host
npm install
```

2. Register the native messaging host (run as administrator):
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\register_host.ps1
```

### 3. Load the Extension

1. Open Chrome/Edge and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder
4. Note your extension ID (needed for native messaging host)

### 4. Configure Extension

1. Click the Chess Arrows icon in your browser toolbar
2. Configure:
   - LC0 engine path (e.g., `C:/chess/lc0/lc0.exe`)
   - Maia weights path (e.g., `C:/chess/maia/maia-1900.pb.gz`)
   - Arrow appearance preferences
3. Save settings

## Usage

Visit Lichess or Chess.com and the extension will automatically:
- Show arrows for the best moves
- Display position evaluation
- Update analysis as the position changes

### Settings

Customize via the extension popup:
- Arrow colors for best and alternative moves
- Arrow thickness
- Number of alternative moves to show
- Show/hide evaluation display

## Troubleshooting

### Engine Connection

If the engine isn't connecting:
1. Verify engine and weights paths
2. Check native messaging host registration
3. Test LC0 from command line
4. Review browser console logs

### Display Issues

If arrows aren't appearing:
1. Refresh the chess website
2. Check extension settings
3. Verify extension is enabled
4. Try a different chess website

### Performance

To improve performance:
1. Reduce analysis depth
2. Show fewer alternative moves
3. Adjust engine thread count

## Security Note

This extension requires native messaging permissions to communicate with the local LC0 engine. The native messaging host is configured to only accept connections from this specific extension.

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Feel free to:
1. Submit bug reports
2. Propose new features
3. Create pull requests

## Credits

- [Leela Chess Zero](https://lczero.org/) - Chess engine
- [Maia Chess](https://github.com/CSSLab/maia-chess) - Neural network weights
