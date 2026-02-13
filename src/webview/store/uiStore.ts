import { create } from 'zustand';

export type TabId = 'code' | 'sprites' | 'map' | 'sfx' | 'music' | 'i18n' | 'export';
export type SpriteTool = 'pencil' | 'fill' | 'rect' | 'circle' | 'line' | 'select' | 'hand';
export type MapTool = 'pencil' | 'fill' | 'select' | 'hand';
export type SfxMode = 'bar' | 'tracker';

interface UIState {
    activeTab: TabId;
    editable: boolean;
    showAudio: boolean;
    showRunButton: boolean;
    pico8Running: boolean;

    // Sprite editor
    spriteTool: SpriteTool;
    spriteFgColor: number;
    spriteBgColor: number;
    spriteZoom: number;
    spritePanX: number;
    spritePanY: number;

    // Map editor
    mapTool: MapTool;
    mapSelectedTile: number;
    mapZoom: number;
    mapPanX: number;
    mapPanY: number;

    // SFX editor
    sfxMode: SfxMode;
    sfxSelectedIndex: number;
    sfxSelectedWaveform: number;
    sfxSelectedEffect: number;

    // Music editor
    musicSelectedPattern: number;

    // Actions
    setActiveTab: (tab: TabId) => void;
    setPico8Running: (running: boolean) => void;
    setSpriteTool: (tool: SpriteTool) => void;
    setSpriteFgColor: (color: number) => void;
    setSpriteBgColor: (color: number) => void;
    setSpriteZoom: (zoom: number) => void;
    setSpritePan: (x: number, y: number) => void;
    setMapTool: (tool: MapTool) => void;
    setMapSelectedTile: (tile: number) => void;
    setMapZoom: (zoom: number) => void;
    setMapPan: (x: number, y: number) => void;
    setSfxMode: (mode: SfxMode) => void;
    setSfxSelectedIndex: (index: number) => void;
    setSfxSelectedWaveform: (waveform: number) => void;
    setSfxSelectedEffect: (effect: number) => void;
    setMusicSelectedPattern: (pattern: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
    activeTab: 'code',
    editable: false,
    showAudio: false,
    showRunButton: false,
    pico8Running: false,

    spriteTool: 'pencil',
    spriteFgColor: 7,
    spriteBgColor: 0,
    spriteZoom: 1,
    spritePanX: 0,
    spritePanY: 0,

    mapTool: 'pencil',
    mapSelectedTile: 0,
    mapZoom: 1,
    mapPanX: 0,
    mapPanY: 0,

    sfxMode: 'bar',
    sfxSelectedIndex: 0,
    sfxSelectedWaveform: 0,
    sfxSelectedEffect: 0,

    musicSelectedPattern: 0,

    setActiveTab: (tab) => set({ activeTab: tab }),
    setPico8Running: (running) => set({ pico8Running: running }),
    setSpriteTool: (tool) => set({ spriteTool: tool }),
    setSpriteFgColor: (color) => set({ spriteFgColor: color }),
    setSpriteBgColor: (color) => set({ spriteBgColor: color }),
    setSpriteZoom: (zoom) => set({ spriteZoom: zoom }),
    setSpritePan: (x, y) => set({ spritePanX: x, spritePanY: y }),
    setMapTool: (tool) => set({ mapTool: tool }),
    setMapSelectedTile: (tile) => set({ mapSelectedTile: tile }),
    setMapZoom: (zoom) => set({ mapZoom: zoom }),
    setMapPan: (x, y) => set({ mapPanX: x, mapPanY: y }),
    setSfxMode: (mode) => set({ sfxMode: mode }),
    setSfxSelectedIndex: (index) => set({ sfxSelectedIndex: index }),
    setSfxSelectedWaveform: (waveform) => set({ sfxSelectedWaveform: waveform }),
    setSfxSelectedEffect: (effect) => set({ sfxSelectedEffect: effect }),
    setMusicSelectedPattern: (pattern) => set({ musicSelectedPattern: pattern }),
}));
