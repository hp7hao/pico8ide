// Localization strings for runtime use
// These are used in extension.ts for messages, webview content, etc.

export interface LocaleStrings {
    // Messages
    databaseUpdated: string;
    gameNotFound: string;
    searchPlaceholder: string;
    searchPrompt: string;

    // Disclaimer
    disclaimerTitle: string;
    disclaimerImportant: string;
    disclaimerHobbyProject: string;
    disclaimerNotForSale: string;
    disclaimerAboutTitle: string;
    disclaimerAboutText: string;
    disclaimerPaidSoftware: string;
    disclaimerVisitWebsite: string;
    disclaimerFeaturesTitle: string;
    disclaimerFeature1: string;
    disclaimerFeature2: string;
    disclaimerFeature3: string;
    disclaimerFeature4: string;
    disclaimerFooter1: string;
    disclaimerFooter2: string;

    // Cart viewer tabs
    tabCode: string;
    tabSprites: string;
    tabMap: string;
    tabSfx: string;
    tabMusic: string;
    tabI18n: string;

    // Cart viewer labels
    spriteSheetLabel: string;
    mapLabel: string;
    selectSfx: string;
    play: string;
    stop: string;
    playMusic: string;
    speed: string;
    loop: string;
    playingPattern: string;
    empty: string;

    // Loading states
    loading: string;
    downloading: string;
    extracting: string;
    error: string;
    noImage: string;

    // Run in PICO-8
    pico8PathNotSet: string;
    pico8PathNotFound: string;
    pico8PathSelectPrompt: string;
    runGameFailed: string;
    stopGame: string;
    runInPico8: string;

    // Workspace integration
    convertBanner: string;
    convertButton: string;
    convertSuccess: string;
    companionExists: string;
    openP8File: string;
    exportToP8Prompt: string;
    exportToP8: string;
    keepP8Png: string;
    forkGame: string;
    forkSuccess: string;
    forkNoWorkspace: string;
    previewP8Cart: string;

    // Sprite editor tools
    toolPencil: string;
    toolFill: string;
    toolRectangle: string;
    toolCircle: string;
    toolLine: string;
    toolSelect: string;
    toolHand: string;
    zoomIn: string;
    zoomOut: string;
    zoomFit: string;
    foreground: string;
    background: string;
    position: string;
    spriteLabel: string;
    quickPalette: string;
    undo: string;
    redo: string;
    flagLabel: string;
    flagsLabel: string;

    // Map editor
    tileLabel: string;
    tilePicker: string;

    // Export tab
    tabExport: string;
    exportTitle: string;
    exportAuthor: string;
    exportTemplate: string;
    exportButton: string;
    exportSuccess: string;
    exportError: string;
    exportLocaleVariant: string;
    exportAll: string;
    exportCodeTooLarge: string;
}

const en: LocaleStrings = {
    // Messages
    databaseUpdated: "Database updated successfully!",
    gameNotFound: "Game not found.",
    searchPlaceholder: "Search games...",
    searchPrompt: "Filter by name or author",

    // Disclaimer
    disclaimerTitle: "PICO-8 IDE",
    disclaimerImportant: "Disclaimer",
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
    tabI18n: "i18n",

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
    noImage: "No Image",

    // Run in PICO-8
    pico8PathNotSet: "PICO-8 path is not set. Would you like to set it now?",
    pico8PathNotFound: "PICO-8 executable not found at the configured path.",
    pico8PathSelectPrompt: "Select PICO-8 executable",
    runGameFailed: "Failed to launch PICO-8",
    stopGame: "Stop PICO-8",
    runInPico8: "Run in PICO-8",

    // Workspace integration
    convertBanner: "Convert to .p8 to edit in VS Code",
    convertButton: "Convert to .p8",
    convertSuccess: "Converted! Opening .p8 file...",
    companionExists: "A .p8 text version already exists.",
    openP8File: "Open .p8 File",
    exportToP8Prompt: "Export to .p8 for easier editing?",
    exportToP8: "Export to .p8",
    keepP8Png: "Keep .p8.png",
    forkGame: "Fork to Workspace",
    forkSuccess: "Game forked to workspace",
    forkNoWorkspace: "No workspace folder open.",
    previewP8Cart: "Preview PICO-8 Cart",

    // Sprite editor tools
    toolPencil: "Pencil",
    toolFill: "Fill",
    toolRectangle: "Rectangle",
    toolCircle: "Circle",
    toolLine: "Line",
    toolSelect: "Select",
    toolHand: "Hand",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    zoomFit: "Fit",
    foreground: "FG",
    background: "BG",
    position: "Pos",
    spriteLabel: "Sprite",
    quickPalette: "Quick Palette",
    undo: "Undo",
    redo: "Redo",
    flagLabel: "Flag",
    flagsLabel: "Flags",
    tileLabel: "Tile",
    tilePicker: "Tile Picker",

    // Export tab
    tabExport: "Export",
    exportTitle: "Title",
    exportAuthor: "Author",
    exportTemplate: "Template",
    exportButton: "Export .p8.png",
    exportSuccess: "Exported successfully",
    exportError: "Export failed",
    exportLocaleVariant: "Export",
    exportAll: "Export All",
    exportCodeTooLarge: "Code exceeds 15616 bytes limit",
};

const zhCN: LocaleStrings = {
    // Messages
    databaseUpdated: "数据库更新成功！",
    gameNotFound: "游戏未找到。",
    searchPlaceholder: "搜索游戏...",
    searchPrompt: "按名称或作者筛选",

    // Disclaimer
    disclaimerTitle: "PICO-8 IDE",
    disclaimerImportant: "声明",
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
    tabI18n: "国际化",

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
    noImage: "无图片",

    // Run in PICO-8
    pico8PathNotSet: "未设置 PICO-8 路径。是否现在设置？",
    pico8PathNotFound: "在配置的路径中未找到 PICO-8 可执行文件。",
    pico8PathSelectPrompt: "选择 PICO-8 可执行文件",
    runGameFailed: "启动 PICO-8 失败",
    stopGame: "停止 PICO-8",
    runInPico8: "在 PICO-8 中运行",

    // Workspace integration
    convertBanner: "转换为 .p8 以在 VS Code 中编辑",
    convertButton: "转换为 .p8",
    convertSuccess: "已转换！正在打开 .p8 文件...",
    companionExists: ".p8 文本版本已存在。",
    openP8File: "打开 .p8 文件",
    exportToP8Prompt: "是否导出为 .p8 以便编辑？",
    exportToP8: "导出为 .p8",
    keepP8Png: "保留 .p8.png",
    forkGame: "复制到工作区",
    forkSuccess: "游戏已复制到工作区",
    forkNoWorkspace: "未打开工作区文件夹。",
    previewP8Cart: "预览 PICO-8 卡带",

    // Sprite editor tools
    toolPencil: "画笔",
    toolFill: "填充",
    toolRectangle: "矩形",
    toolCircle: "圆形",
    toolLine: "直线",
    toolSelect: "选择",
    toolHand: "抓手",
    zoomIn: "放大",
    zoomOut: "缩小",
    zoomFit: "适合",
    foreground: "前景",
    background: "背景",
    position: "位置",
    spriteLabel: "精灵",
    quickPalette: "快速调色板",
    undo: "撤销",
    redo: "重做",
    flagLabel: "标志",
    flagsLabel: "标志",
    tileLabel: "图块",
    tilePicker: "图块选择器",

    // Export tab
    tabExport: "导出",
    exportTitle: "标题",
    exportAuthor: "作者",
    exportTemplate: "模板",
    exportButton: "导出 .p8.png",
    exportSuccess: "导出成功",
    exportError: "导出失败",
    exportLocaleVariant: "导出",
    exportAll: "全部导出",
    exportCodeTooLarge: "代码超过 15616 字节限制",
};

// Locale map
const locales: { [key: string]: LocaleStrings } = {
    'en': en,
    'zh_cn': zhCN,
    'zh_tw': zhCN,  // Fallback to simplified Chinese
};

// Get current VS Code language
import * as vscode from 'vscode';

export function getLocale(): LocaleStrings {
    const override = vscode.workspace.getConfiguration('pico8ide').get<string>('language');
    const lang = (override || vscode.env.language).toLowerCase().replace(/-/g, '_');

    // Try exact match first
    if (locales[lang]) {
        return locales[lang];
    }
    // Try language prefix (e.g., 'zh' for 'zh_cn')
    const prefix = lang.split(/[-_]/)[0];
    if (locales[prefix]) {
        return locales[prefix];
    }
    // Default to English
    return en;
}

// Shorthand function
export function t(): LocaleStrings {
    return getLocale();
}
