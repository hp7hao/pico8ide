"use strict";
// Localization strings for runtime use
// These are used in extension.ts for messages, webview content, etc.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocale = getLocale;
exports.t = t;
const en = {
    // Messages
    databaseUpdated: "Database updated successfully!",
    gameNotFound: "Game not found.",
    searchPlaceholder: "Search games...",
    searchPrompt: "Filter by name or author",
    // Disclaimer
    disclaimerTitle: "PICO-8 IDE Browser",
    disclaimerImportant: "Important Disclaimer",
    disclaimerHobbyProject: "This is a <strong>hobby project</strong> created for <strong>learning purposes only</strong>.",
    disclaimerNotForSale: "This extension is <strong>NOT for sale</strong> and is <strong>NOT affiliated with Lexaloffle Games</strong>.",
    disclaimerAboutTitle: "About PICO-8",
    disclaimerAboutText: "PICO-8 is a fantasy console created by <strong>Lexaloffle Games</strong>. It's a wonderful platform for learning game development and creating retro-style games.",
    disclaimerPaidSoftware: "<strong>PICO-8 is paid software.</strong> If you're interested in creating games or exploring the full PICO-8 experience, please support the developer by visiting the official website:",
    disclaimerVisitWebsite: "https://www.lexaloffle.com/pico-8.php",
    disclaimerFeaturesTitle: "What This Extension Does",
    disclaimerFeature1: "Browse PICO-8 games from the BBS (Bulletin Board System)",
    disclaimerFeature2: "View game metadata, sprites, maps, and code",
    disclaimerFeature3: "Preview SFX and music patterns",
    disclaimerFeature4: "Learn how PICO-8 cartridges are structured",
    disclaimerFooter1: "Close this tab to continue using the extension.",
    disclaimerFooter2: "This message appears each time the extension is activated.",
    // Cart viewer tabs
    tabCode: "LUA Code",
    tabSprites: "Sprites",
    tabMap: "Map",
    tabSfx: "SFX",
    tabMusic: "Music",
    // Cart viewer labels
    spriteSheetLabel: "128x128 Sprite Sheet",
    mapLabel: "128x64 Map (1024x512 pixels) - Lower 32 rows share memory with sprite sheet",
    selectSfx: "Select an SFX to view details",
    play: "Play",
    stop: "Stop",
    playMusic: "Play Music",
    speed: "Speed",
    loop: "Loop",
    playingPattern: "Playing pattern",
    empty: "empty",
    // Loading states
    loading: "Loading...",
    downloading: "Downloading cartridge...",
    extracting: "Extracting data...",
    error: "Error",
    noImage: "No Image"
};
const zhCN = {
    // Messages
    databaseUpdated: "数据库更新成功！",
    gameNotFound: "游戏未找到。",
    searchPlaceholder: "搜索游戏...",
    searchPrompt: "按名称或作者筛选",
    // Disclaimer
    disclaimerTitle: "PICO-8 IDE 浏览器",
    disclaimerImportant: "重要声明",
    disclaimerHobbyProject: "这是一个<strong>业余项目</strong>，仅供<strong>学习目的</strong>。",
    disclaimerNotForSale: "此扩展<strong>非卖品</strong>，且<strong>与 Lexaloffle Games 无关</strong>。",
    disclaimerAboutTitle: "关于 PICO-8",
    disclaimerAboutText: "PICO-8 是由 <strong>Lexaloffle Games</strong> 创建的梦幻游戏机。它是学习游戏开发和创建复古风格游戏的绝佳平台。",
    disclaimerPaidSoftware: "<strong>PICO-8 是付费软件。</strong>如果您有兴趣制作游戏或体验完整的 PICO-8，请访问官方网站支持开发者：",
    disclaimerVisitWebsite: "https://www.lexaloffle.com/pico-8.php",
    disclaimerFeaturesTitle: "此扩展的功能",
    disclaimerFeature1: "浏览 PICO-8 BBS（公告板系统）上的游戏",
    disclaimerFeature2: "查看游戏元数据、精灵图、地图和代码",
    disclaimerFeature3: "预览音效和音乐模式",
    disclaimerFeature4: "了解 PICO-8 卡带的结构",
    disclaimerFooter1: "关闭此标签页以继续使用扩展。",
    disclaimerFooter2: "此消息在每次扩展激活时显示。",
    // Cart viewer tabs
    tabCode: "LUA 代码",
    tabSprites: "精灵图",
    tabMap: "地图",
    tabSfx: "音效",
    tabMusic: "音乐",
    // Cart viewer labels
    spriteSheetLabel: "128x128 精灵图表",
    mapLabel: "128x64 地图 (1024x512 像素) - 下方32行与精灵图共享内存",
    selectSfx: "选择一个音效查看详情",
    play: "播放",
    stop: "停止",
    playMusic: "播放音乐",
    speed: "速度",
    loop: "循环",
    playingPattern: "正在播放模式",
    empty: "空",
    // Loading states
    loading: "加载中...",
    downloading: "正在下载卡带...",
    extracting: "正在提取数据...",
    error: "错误",
    noImage: "无图片"
};
// Locale map
const locales = {
    'en': en,
    'zh-cn': zhCN,
    'zh-tw': zhCN, // Fallback to simplified Chinese
};
// Get current VS Code language
const vscode = require("vscode");
let currentLocale = null;
function getLocale() {
    if (currentLocale) {
        return currentLocale;
    }
    const lang = vscode.env.language.toLowerCase();
    // Try exact match first
    if (locales[lang]) {
        currentLocale = locales[lang];
    }
    // Try language prefix (e.g., 'zh' for 'zh-cn')
    else if (locales[lang.split('-')[0]]) {
        currentLocale = locales[lang.split('-')[0]];
    }
    // Default to English
    else {
        currentLocale = en;
    }
    return currentLocale;
}
// Shorthand function
function t() {
    return getLocale();
}
//# sourceMappingURL=i18n.js.map