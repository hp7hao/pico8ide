import { useUIStore, type TabId } from '../store/uiStore';
import { useMetaStore } from '../store/metaStore';
import { useFontContext } from '../hooks/useFontContext';
import { generateI18nLua } from '../utils/i18nCodegen';
import { getVscodeApi } from '../vscodeApi';
import type { LocaleStrings } from '../types';

interface TabBarProps {
    locale: LocaleStrings;
}

const TAB_DEFS: { id: TabId; localeKey: keyof LocaleStrings; editableOnly?: boolean }[] = [
    { id: 'code', localeKey: 'tabCode' },
    { id: 'sprites', localeKey: 'tabSprites' },
    { id: 'map', localeKey: 'tabMap' },
    { id: 'sfx', localeKey: 'tabSfx' },
    { id: 'music', localeKey: 'tabMusic' },
    { id: 'i18n', localeKey: 'tabI18n', editableOnly: true },
    { id: 'export', localeKey: 'tabExport', editableOnly: true },
];

export function TabBar({ locale }: TabBarProps) {
    const activeTab = useUIStore((s) => s.activeTab);
    const editable = useUIStore((s) => s.editable);
    const setActiveTab = useUIStore((s) => s.setActiveTab);
    const showRunButton = useUIStore((s) => s.showRunButton);
    const pico8Running = useUIStore((s) => s.pico8Running);

    const visibleTabs = TAB_DEFS.filter((t) => !t.editableOnly || editable);

    return (
        <div className="tab-header">
            {visibleTabs.map((tab) => (
                <div
                    key={tab.id}
                    className={`tab${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                >
                    {locale[tab.localeKey]}
                </div>
            ))}
            {showRunButton && (
                <>
                    <div className="tab-spacer" />
                    <RunButton locale={locale} running={pico8Running} />
                </>
            )}
        </div>
    );
}

function RunButton({ locale, running }: { locale: LocaleStrings; running: boolean }) {
    const { fontCtx } = useFontContext();

    const handleClick = () => {
        if (running) {
            getVscodeApi().postMessage({ type: 'stop' });
        } else {
            // Generate i18n Lua code if i18n data is configured
            const i18nData = useMetaStore.getState().i18nData;
            let i18nLuaCode: string | null = null;
            if (i18nData && i18nData.outputLocale) {
                i18nLuaCode = generateI18nLua(i18nData.outputLocale, i18nData, fontCtx);
            }
            getVscodeApi().postMessage({ type: 'run', i18nLuaCode });
        }
    };

    return (
        <button
            id="btn-run-pico8"
            className={`run-btn ${running ? 'running' : 'idle'}`}
            onClick={handleClick}
        >
            {running ? `\u25FC ${locale.stopGame}` : `\u25B6 ${locale.runInPico8}`}
        </button>
    );
}
