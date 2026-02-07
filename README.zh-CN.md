# PICO-8 IDE

[English](README.md) | [中文](README.zh-CN.md)

一个用于浏览和体验 PICO-8 游戏的 VS Code 扩展。

![PICO-8 IDE](resources/screenshots/pico8ide.png)

> **注意：** 目前仅支持查看卡带数据（代码、精灵图、地图、音效、音乐），编辑和运行游戏功能即将推出。

## 功能

- 浏览 [Lexaloffle BBS](https://www.lexaloffle.com/bbs/?cat=7) 上的 PICO-8 游戏
- 按名称、作者或游戏 ID 搜索游戏
- 查看游戏详情、缩略图和元数据
- 打开并阅读 PICO-8 卡带源代码
- 查看精灵图、地图、音效和音乐数据
- 精选游戏列表

## 使用方法

安装后，点击活动栏中的 PICO-8 图标即可打开游戏浏览器。游戏数据来自定期更新的数据库。

## 创建你自己的游戏列表

本扩展支持由 [fcdb](https://github.com/hp7hao/fcdb) 项目驱动的精选游戏列表。你可以创建自己的列表并贡献到数据库中。

### 1. 创建列表文件

在 `fcdb/curated/pico8/lists/` 目录下添加一个 JSON 文件，文件名任意（例如 `mylist.json`）。文件内容是一个数组，每个条目可以是：

- **游戏 ID 字符串** — 引用数据库中已有的游戏
- **完整的游戏元数据对象** — 定义一个新的自定义游戏

```json
[
  "131736",
  {
    "id": "my_custom_game",
    "name": "My Game",
    "source": "custom",
    "author": { "name": "yourname" },
    "description": "一个很酷的 PICO-8 游戏。",
    "created": "2025-01-01 00:00:00",
    "updated": "2025-01-01 00:00:00",
    "extension": {
      "cart_url": "https://example.com/mygame.p8.png",
      "tags": ["platformer"]
    }
  }
]
```

### 2. 内联游戏的必填字段

| 字段 | 说明 |
|------|------|
| `id` | 游戏的唯一标识符 |
| `name` | 显示名称 |
| `author.name` | 作者名称 |
| `created` | 创建日期（`YYYY-MM-DD HH:MM:SS`） |
| `updated` | 最后更新日期（`YYYY-MM-DD HH:MM:SS`） |

可选字段：`source`（默认为 `"custom"`）、`description`、`license`、`ref_id`、`extension`（用于 `cart_url`、`tags` 等）

### 3. 构建数据库

```bash
cd fcdbtool
npm run build && npm run db:pico8
```

构建流程会：
- 将内联游戏添加到主数据库
- 如果提供了 `cart_url`，自动下载卡带
- 自动生成缩略图
- 将列表视图输出到 `fcdb/dist/pico8/lists/yourlist.json`

## 免责声明

本项目仅为业余学习项目，不用于销售，与 Lexaloffle Games 无关。

如果你对 PICO-8 感兴趣，请访问官方网站：https://www.lexaloffle.com/pico-8.php

## 许可证

MIT
