import type { InitData, CartData, LocaleStrings } from '../types';

/**
 * Generate a simple gradient sprite sheet (8192 bytes).
 * Each pixel cycles through the 16 PICO-8 colors.
 */
function generateGradientGfx(): number[] {
    const gfx = new Array(8192).fill(0);
    for (let i = 0; i < 8192; i++) {
        const lo = i % 16;
        const hi = (i + 1) % 16;
        gfx[i] = (hi << 4) | lo;
    }
    return gfx;
}

function generateEmptyArray(size: number): number[] {
    return new Array(size).fill(0);
}

const mockLocale: LocaleStrings = {
    databaseUpdated: 'Database updated',
    gameNotFound: 'Game not found',
    searchPlaceholder: 'Search...',
    searchPrompt: 'Search for games',

    tabCode: 'Code',
    tabSprites: 'Sprites',
    tabMap: 'Map',
    tabSfx: 'SFX',
    tabMusic: 'Music',
    tabI18n: 'I18n',
    tabExport: 'Export',

    spriteSheetLabel: 'Sprite Sheet',
    mapLabel: 'Map',
    selectSfx: 'Select SFX',
    play: 'Play',
    stop: 'Stop',
    playMusic: 'Play Music',
    speed: 'Speed',
    loop: 'Loop',
    playingPattern: 'Playing Pattern',
    empty: '(empty)',

    loading: 'Loading...',
    downloading: 'Downloading...',
    extracting: 'Extracting...',
    error: 'Error',
    noImage: 'No image',

    pico8PathNotSet: 'PICO-8 path not set',
    pico8PathNotFound: 'PICO-8 not found',
    pico8PathSelectPrompt: 'Select PICO-8 executable',
    runGameFailed: 'Failed to run game',
    stopGame: 'Stop',
    runInPico8: 'Run',

    convertBanner: 'Convert',
    convertButton: 'Convert',
    convertSuccess: 'Converted',
    companionExists: 'Companion exists',
    openP8File: 'Open .p8',
    exportToP8Prompt: 'Export to .p8?',
    exportToP8: 'Export to .p8',
    keepP8Png: 'Keep .p8.png',
    forkGame: 'Fork Game',
    forkSuccess: 'Forked',
    forkNoWorkspace: 'No workspace',
    previewP8Cart: 'Preview',

    toolPencil: 'Pencil',
    toolFill: 'Fill',
    toolRectangle: 'Rectangle',
    toolCircle: 'Circle',
    toolLine: 'Line',
    toolSelect: 'Select',
    toolHand: 'Hand',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    zoomFit: 'Zoom Fit',
    foreground: 'FG',
    background: 'BG',
    position: 'Pos',
    spriteLabel: 'Sprite',
    quickPalette: 'Quick Palette',
    undo: 'Undo',
    redo: 'Redo',
    flagLabel: 'Flag',
    flagsLabel: 'Flags',

    tileLabel: 'Tile',
    tilePicker: 'Tile Picker',

    exportTitle: 'Title',
    exportAuthor: 'Author',
    exportTemplate: 'Template',
    exportButton: 'Export',
    exportSuccess: 'Export success',
    exportError: 'Export error',
    exportLocaleVariant: 'Locale Variant',
    exportAll: 'Export All',
    exportCodeTooLarge: 'Code too large',
};

const mockCartData: CartData = {
    gfx: generateGradientGfx(),
    map: generateEmptyArray(4096),
    gfxFlags: generateEmptyArray(256),
    sfx: generateEmptyArray(4352),
    music: generateEmptyArray(256),
    code: '-- standalone demo\nprint("hello pico-8!")\n',
    label: null,
};

export function createMockInitData(): InitData {
    return {
        cartData: mockCartData,
        locale: mockLocale,
        editable: true,
        showAudio: true,
        showRunButton: true,
        monacoBaseUri: './resources/monaco/',
        fontUri: './resources/fonts/BoutiqueBitmap7x7.woff2',
        i18nData: null,
        metaData: {
            meta: { title: 'Demo Cart', author: 'Standalone', template: 'default' },
            i18n: null,
        },
        templatePreviews: {},
        editorFontSize: 14,
        editorFontFamily: 'monospace',
        editorLineHeight: 1.5,
    };
}
