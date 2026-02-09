// Shared interfaces and constants for PICO-8 cartridge data

// Cart data extracted from PNG
export interface CartData {
    code: string;
    gfx: number[];      // 0x0000-0x1FFF (8192 bytes) - sprite sheet
    map: number[];      // 0x2000-0x2FFF (4096 bytes) - upper map (lower 32 rows in gfx)
    gfxFlags: number[]; // 0x3000-0x30FF (256 bytes)
    music: number[];    // 0x3100-0x31FF (256 bytes) - 64 music patterns x 4 bytes
    sfx: number[];      // 0x3200-0x42FF (4352 bytes) - 64 SFX x 68 bytes
    label: string;      // Base64 data URL of the 128x128 label image
}

// SFX note structure for display
export interface SfxNote {
    pitch: number;      // 0-63
    waveform: number;   // 0-7 (or 8-15 for custom)
    volume: number;     // 0-7
    effect: number;     // 0-7
    customWave: boolean; // bit 7 of waveform byte
}

// SFX structure for display
export interface SfxData {
    notes: SfxNote[];   // 32 notes
    editorMode: number;
    speed: number;
    loopStart: number;
    loopEnd: number;
    isCustomWaveform: boolean;
}

// Music pattern structure
export interface MusicPattern {
    channels: number[]; // 4 channel SFX ids (0-63, or 64+ if disabled)
    channelEnabled: boolean[];
    loopStart: boolean;
    loopEnd: boolean;
    stopAtEnd: boolean;
}

// PICO-8 16-color palette
export const PICO8_PALETTE = [
    '#000000', // 0 black
    '#1D2B53', // 1 dark-blue
    '#7E2553', // 2 dark-purple
    '#008751', // 3 dark-green
    '#AB5236', // 4 brown
    '#5F574F', // 5 dark-grey
    '#C2C3C7', // 6 light-grey
    '#FFF1E8', // 7 white
    '#FF004D', // 8 red
    '#FFA300', // 9 orange
    '#FFEC27', // 10 yellow
    '#00E436', // 11 green
    '#29ADFF', // 12 blue
    '#83769C', // 13 lavender
    '#FF77A8', // 14 pink
    '#FFCCAA', // 15 light-peach
];
