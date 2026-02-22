import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUIStore } from '../store/uiStore';

describe('uiStore', () => {
    it('defaults activeTab to code', () => {
        expect(useUIStore.getState().activeTab).toBe('code');
    });

    it('setActiveTab changes tab', () => {
        useUIStore.getState().setActiveTab('sprites');
        expect(useUIStore.getState().activeTab).toBe('sprites');

        useUIStore.getState().setActiveTab('map');
        expect(useUIStore.getState().activeTab).toBe('map');
    });

    it('setPico8Running toggles running state', () => {
        expect(useUIStore.getState().pico8Running).toBe(false);
        useUIStore.getState().setPico8Running(true);
        expect(useUIStore.getState().pico8Running).toBe(true);
        useUIStore.getState().setPico8Running(false);
        expect(useUIStore.getState().pico8Running).toBe(false);
    });

    it('sprite tool defaults to pencil', () => {
        expect(useUIStore.getState().spriteTool).toBe('pencil');
    });

    it('setSpriteTool changes tool', () => {
        useUIStore.getState().setSpriteTool('fill');
        expect(useUIStore.getState().spriteTool).toBe('fill');
        useUIStore.getState().setSpriteTool('select');
        expect(useUIStore.getState().spriteTool).toBe('select');
    });

    it('sprite colors default fg=7 bg=0', () => {
        expect(useUIStore.getState().spriteFgColor).toBe(7);
        expect(useUIStore.getState().spriteBgColor).toBe(0);
    });

    it('setSpriteFgColor and setSpriteBgColor', () => {
        useUIStore.getState().setSpriteFgColor(8);
        expect(useUIStore.getState().spriteFgColor).toBe(8);
        useUIStore.getState().setSpriteBgColor(3);
        expect(useUIStore.getState().spriteBgColor).toBe(3);
    });

    it('setSpriteZoom and setSpritePan', () => {
        useUIStore.getState().setSpriteZoom(16);
        expect(useUIStore.getState().spriteZoom).toBe(16);
        useUIStore.getState().setSpritePan(50, 100);
        expect(useUIStore.getState().spritePanX).toBe(50);
        expect(useUIStore.getState().spritePanY).toBe(100);
    });

    it('map state management', () => {
        useUIStore.getState().setMapTool('fill');
        expect(useUIStore.getState().mapTool).toBe('fill');

        useUIStore.getState().setMapSelectedTile(42);
        expect(useUIStore.getState().mapSelectedTile).toBe(42);

        useUIStore.getState().setMapZoom(4);
        expect(useUIStore.getState().mapZoom).toBe(4);

        useUIStore.getState().setMapPan(10, 20);
        expect(useUIStore.getState().mapPanX).toBe(10);
        expect(useUIStore.getState().mapPanY).toBe(20);
    });

    it('sfx state management', () => {
        useUIStore.getState().setSfxMode('tracker');
        expect(useUIStore.getState().sfxMode).toBe('tracker');

        useUIStore.getState().setSfxSelectedIndex(32);
        expect(useUIStore.getState().sfxSelectedIndex).toBe(32);

        useUIStore.getState().setSfxSelectedWaveform(5);
        expect(useUIStore.getState().sfxSelectedWaveform).toBe(5);

        useUIStore.getState().setSfxSelectedEffect(3);
        expect(useUIStore.getState().sfxSelectedEffect).toBe(3);
    });

    it('music state management', () => {
        useUIStore.getState().setMusicSelectedPattern(42);
        expect(useUIStore.getState().musicSelectedPattern).toBe(42);
    });
});
