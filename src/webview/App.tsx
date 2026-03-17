import { useCallback } from 'react';
import { TabBar } from './components/TabBar';
import { TabContainer } from './components/TabContainer';
import { useUIStore } from './store/uiStore';
import { useCartStore } from './store/cartStore';
import { useMetaStore } from './store/metaStore';
import { useLibStore } from './store/libStore';
import { useVscodeMessage } from './hooks/useVscodeMessaging';
import { useFontLoader, FontCtxContext } from './hooks/useFontContext';
import type { InitData } from './types';

export function App() {
    const initData = window.__INIT_DATA__;
    const font = useFontLoader(initData.fontUri);

    // Handle messages from extension host
    const handleMessage = useCallback((msg: any) => {
        if (msg.type === 'runState') {
            useUIStore.getState().setPico8Running(msg.running);
        }
        if (msg.type === 'libsUpdated') {
            useLibStore.getState().setAvailableLibs(msg.libs);
        }
        if (msg.type === 'restoreState') {
            const cart = useCartStore.getState();
            const meta = useMetaStore.getState();
            if (msg.currentCode !== undefined) cart.silentSetCode(msg.currentCode);
            if (msg.currentGfx !== undefined) cart.silentSetGfx(msg.currentGfx);
            if (msg.currentMap !== undefined) {
                cart.silentSetMap(msg.currentMap, msg.currentGfx);
            }
            if (msg.currentFlags !== undefined) cart.silentSetFlags(msg.currentFlags);
            if (msg.currentSfx !== undefined) cart.silentSetSfx(msg.currentSfx);
            if (msg.currentMusic !== undefined) cart.silentSetMusic(msg.currentMusic);
            if (msg.currentMeta !== undefined) meta.silentSetMeta(msg.currentMeta.meta ?? msg.currentMeta);
            if (msg.currentI18nData !== undefined) meta.silentSetI18nData(msg.currentI18nData);
        }
    }, []);

    useVscodeMessage(handleMessage);

    return (
        <FontCtxContext.Provider value={font}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <TabBar locale={initData.locale} />
                <TabContainer
                    locale={initData.locale}
                    monacoBaseUri={initData.monacoBaseUri}
                    fontUri={initData.fontUri}
                    editorFontSize={initData.editorFontSize}
                    editorFontFamily={initData.editorFontFamily}
                    editorLineHeight={initData.editorLineHeight}
                />
            </div>
        </FontCtxContext.Provider>
    );
}
