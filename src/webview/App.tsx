import { useCallback } from 'react';
import { TabBar } from './components/TabBar';
import { TabContainer } from './components/TabContainer';
import { useUIStore } from './store/uiStore';
import { useVscodeMessage } from './hooks/useVscodeMessaging';
import type { InitData } from './types';

export function App() {
    const initData = window.__INIT_DATA__;

    // Handle messages from extension host
    const handleMessage = useCallback((msg: any) => {
        if (msg.type === 'runState') {
            useUIStore.getState().setPico8Running(msg.running);
        }
    }, []);

    useVscodeMessage(handleMessage);

    return (
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
    );
}
