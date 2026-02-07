# PICO-8 IDE

[English](README.md) | [中文](README.zh-CN.md)

A VS Code extension for browsing and playing PICO-8 games.

![PICO-8 IDE](resources/screenshots/pico8ide.png)

> **Note:** The extension currently supports viewing cartridge data only (code, sprites, maps, SFX, music). Editing and running games is coming soon.

## Features

- Browse PICO-8 games from the [Lexaloffle BBS](https://www.lexaloffle.com/bbs/?cat=7)
- Search games by name, author, or game ID
- View game details, thumbnails, and metadata
- Open and read PICO-8 cartridge source code
- View sprites, maps, SFX, and music data
- Curated game lists

## Usage

After installing, click the PICO-8 icon in the Activity Bar to open the game browser. Games are loaded from a regularly updated database.

## Create Your Own Game List

The extension supports curated game lists powered by the [fcdb](https://github.com/hp7hao/fcdb) project. You can create your own list and contribute it to the database.

### 1. Create a list file

Add a JSON file to `fcdb/curated/pico8/lists/` with any name (e.g. `mylist.json`). The file is an array where each entry can be:

- **A game ID string** — references an existing game in the database
- **A full game metadata object** — defines a new custom game

```json
[
  "131736",
  {
    "id": "my_custom_game",
    "name": "My Game",
    "source": "custom",
    "author": { "name": "yourname" },
    "description": "A cool PICO-8 game.",
    "created": "2025-01-01 00:00:00",
    "updated": "2025-01-01 00:00:00",
    "extension": {
      "cart_url": "https://example.com/mygame.p8.png",
      "tags": ["platformer"]
    }
  }
]
```

### 2. Required fields for inline games

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the game |
| `name` | Display name |
| `author.name` | Author name |
| `created` | Creation date (`YYYY-MM-DD HH:MM:SS`) |
| `updated` | Last update date (`YYYY-MM-DD HH:MM:SS`) |

Optional fields: `source` (defaults to `"custom"`), `description`, `license`, `ref_id`, and `extension` (for `cart_url`, `tags`, etc.)

### 3. Build the database

```bash
cd fcdbtool
npm run build && npm run db:pico8
```

The build pipeline will:
- Add inline games to the master database
- Download cartridges from `cart_url` if provided
- Generate thumbnails automatically
- Output the list view to `fcdb/dist/pico8/lists/yourlist.json`

## Disclaimer

This is a hobby project for learning purposes only. Not for sale and not affiliated with Lexaloffle Games.

If you're interested in PICO-8, please visit the official website: https://www.lexaloffle.com/pico-8.php

## License

MIT
