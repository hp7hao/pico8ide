import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createMockInitData } from '../standalone/mockInitData';
import { useCartStore } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';
import { useMetaStore } from '../store/metaStore';
import { PICO8_PALETTE } from '../types';
import { afterEach } from 'vitest';

// Provide mock init data so components can read window.__INIT_DATA__
window.__INIT_DATA__ = createMockInitData();

// Reset stores and clean up DOM after each test
afterEach(() => {
    cleanup();
    const initData = createMockInitData();
    const { cartData } = initData;

    useCartStore.setState({
        gfx: [...cartData.gfx],
        map: [...cartData.map],
        flags: [...cartData.gfxFlags],
        sfx: [...cartData.sfx],
        music: [...cartData.music],
        code: cartData.code,
        label: cartData.label,
        pal: PICO8_PALETTE,
    });

    useUIStore.setState({
        activeTab: 'code',
        editable: true,
        showAudio: true,
        showRunButton: true,
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
    });

    useMetaStore.setState({
        meta: { title: '', author: '', template: 'default' },
        i18nData: null,
    });
});
