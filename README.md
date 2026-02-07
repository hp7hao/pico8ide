# PICO-8 IDE

A VS Code extension for browsing and playing PICO-8 games.

## Features

- Browse PICO-8 games from the [Lexaloffle BBS](https://www.lexaloffle.com/bbs/?cat=7)
- Search games by name
- View game details, thumbnails, and metadata
- Open and read PICO-8 cartridge source code
- Curated game lists

## Usage

After installing, click the PICO-8 IDE icon in the activity bar to open the game browser. Games are loaded from a regularly updated database.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `pico8ide.dataMode` | Data source mode (`remote` or `local`) | `remote` |
| `pico8ide.remoteUrl` | URL for the remote database bundle | GitHub releases URL |
| `pico8ide.localPath` | Path to a local `fcdb/dist/pico8` directory | — |

## Development

```bash
npm install
npm run compile
```

Press **F5** in VS Code to launch the extension in debug mode. If a sibling `fcdb/dist/pico8/` directory exists, it will automatically use local data.

## Disclaimer

This is a hobby project for learning purposes only. Not for sale and not affiliated with Lexaloffle Games.

If you're interested in PICO-8, please visit the official website: https://www.lexaloffle.com/pico-8.php

## License

MIT
