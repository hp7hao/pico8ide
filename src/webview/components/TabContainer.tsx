import { useUIStore } from '../store/uiStore';
import { CodeTab } from './code/CodeTab';
import { SpriteTab } from './sprites/SpriteTab';
import { MapTab } from './map/MapTab';
import { SfxTab } from './sfx/SfxTab';
import { MusicTab } from './music/MusicTab';
import { I18nTab } from './i18n/I18nTab';
import { ExportTab } from './export/ExportTab';
import type { LocaleStrings } from '../types';

interface TabContainerProps {
    locale: LocaleStrings;
    monacoBaseUri: string;
    fontUri: string;
    editorFontSize: number;
    editorFontFamily: string;
    editorLineHeight: number;
}

const tabStyle = (active: boolean): React.CSSProperties => ({
    display: active ? 'flex' : 'none',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
});

export function TabContainer(props: TabContainerProps) {
    const activeTab = useUIStore((s) => s.activeTab);
    const editable = useUIStore((s) => s.editable);

    return (
        <div className="tab-content">
            <div style={tabStyle(activeTab === 'code')}>
                <CodeTab
                    monacoBaseUri={props.monacoBaseUri}
                    editorFontSize={props.editorFontSize}
                    editorFontFamily={props.editorFontFamily}
                    editorLineHeight={props.editorLineHeight}
                    editable={editable}
                    locale={props.locale}
                />
            </div>
            <div style={tabStyle(activeTab === 'sprites')}>
                <SpriteTab locale={props.locale} />
            </div>
            <div style={tabStyle(activeTab === 'map')}>
                <MapTab locale={props.locale} />
            </div>
            <div style={tabStyle(activeTab === 'sfx')}>
                <SfxTab locale={props.locale} />
            </div>
            <div style={tabStyle(activeTab === 'music')}>
                <MusicTab locale={props.locale} />
            </div>
            {editable && (
                <>
                    <div style={tabStyle(activeTab === 'i18n')}>
                        <I18nTab locale={props.locale} fontUri={props.fontUri} />
                    </div>
                    <div style={tabStyle(activeTab === 'export')}>
                        <ExportTab locale={props.locale} />
                    </div>
                </>
            )}
        </div>
    );
}
