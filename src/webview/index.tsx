import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useCartStore } from './store/cartStore';
import { useUIStore } from './store/uiStore';
import { useMetaStore } from './store/metaStore';
import { PICO8_PALETTE } from './types';
import './styles/global.css';

console.log('[pico8ide] webview bundle loaded');

// Initialize stores BEFORE React renders — this ensures components
// see the correct data on their very first render.
const initData = window.__INIT_DATA__;
if (initData) {
    const { cartData, editable, showAudio, showRunButton, i18nData, metaData } = initData;
    console.log('[pico8ide] initializing stores with cartData, gfx:', cartData.gfx?.length, 'code:', cartData.code?.length);

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
        editable,
        showAudio,
        showRunButton,
    });

    if (metaData) {
        useMetaStore.setState({
            meta: metaData.meta || { title: '', author: '', template: 'default' },
            i18nData: metaData.i18n || i18nData || null,
        });
    } else if (i18nData) {
        useMetaStore.setState({ i18nData });
    }
}

const rootEl = document.getElementById('root');
if (rootEl) {
    console.log('[pico8ide] mounting React app');
    try {
        const root = createRoot(rootEl);
        root.render(<App />);
        console.log('[pico8ide] React app rendered');
    } catch (e) {
        console.error('[pico8ide] React render error:', e);
        rootEl.textContent = 'Error: ' + String(e);
    }
} else {
    console.error('[pico8ide] #root element not found');
}
