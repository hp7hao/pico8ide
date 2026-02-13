// Shared types for the webview, mirrored from extension

export interface CartData {
    gfx: number[];
    map: number[];
    gfxFlags: number[];
    sfx: number[];
    music: number[];
    code: string;
    label: string | null;
}

export interface MetaData {
    meta: {
        title: string;
        author: string;
        template: string;
    };
    i18n?: I18nData | null;
}

export interface I18nData {
    defaultLocale?: string;
    outputLocale?: string;
    locales: string[];
    entries: I18nEntry[];
}

export interface I18nEntry {
    key: string;
    sourceText?: string;
    translations: Record<string, string>;
}

export interface LocaleStrings {
    // Messages
    databaseUpdated: string;
    gameNotFound: string;
    searchPlaceholder: string;
    searchPrompt: string;

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

    // Catch-all for any additional locale keys
    [key: string]: string;
}

// PICO-8 16-color palette
export const PICO8_PALETTE: number[][] = [
    [0, 0, 0],       // 0: black
    [29, 43, 83],     // 1: dark blue
    [126, 37, 83],    // 2: dark purple
    [0, 135, 81],     // 3: dark green
    [171, 82, 54],    // 4: brown
    [95, 87, 79],     // 5: dark gray
    [194, 195, 199],  // 6: light gray
    [255, 241, 232],  // 7: white
    [255, 0, 77],     // 8: red
    [255, 163, 0],    // 9: orange
    [255, 236, 39],   // 10: yellow
    [0, 228, 54],     // 11: green
    [41, 173, 255],   // 12: blue
    [131, 118, 156],  // 13: lavender
    [255, 119, 168],  // 14: pink
    [255, 204, 170],  // 15: peach
];

/** Data passed from extension host to webview via window.__INIT_DATA__ */
export interface InitData {
    cartData: CartData;
    locale: LocaleStrings;
    editable: boolean;
    showAudio: boolean;
    showRunButton: boolean;
    monacoBaseUri: string;
    fontUri: string;
    i18nData: I18nData | null;
    metaData: MetaData | null;
    templatePreviews: Record<string, string>;
    editorFontSize: number;
    editorFontFamily: string;
    editorLineHeight: number;
}

declare global {
    interface Window {
        __INIT_DATA__: InitData;
    }
}
