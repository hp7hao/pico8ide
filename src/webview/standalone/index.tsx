import { createRoot } from 'react-dom/client';
import { App } from '../App';
import { useCartStore } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';
import { useMetaStore } from '../store/metaStore';
import { PICO8_PALETTE } from '../types';
import { createMockInitData } from './mockInitData';
import '../styles/global.css';

console.log('[standalone] webview bundle loaded');

// Set up mock init data before any component reads it
const initData = createMockInitData();
window.__INIT_DATA__ = initData;

const { cartData, editable, showAudio, showRunButton, i18nData, metaData } = initData;

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

const rootEl = document.getElementById('root');
if (rootEl) {
    console.log('[standalone] mounting React app');
    const root = createRoot(rootEl);
    root.render(<App />);
    console.log('[standalone] React app rendered');
} else {
    console.error('[standalone] #root element not found');
}
