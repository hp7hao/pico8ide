import { useMemo } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useMetaStore } from '../../store/metaStore';
import { useLibStore } from '../../store/libStore';
import { useFontContext } from '../../hooks/useFontContext';
import { countTokens, countChars } from '../../../extension/tokenCounter';
import { generateI18nLua } from '../../utils/i18nCodegen';
import { parseIncludes } from '../../utils/libUtils';
import type { LocaleStrings } from '../../types';

interface CodeToolbarProps {
    locale: LocaleStrings;
    editable: boolean;
}

const MAX_TOKENS = 8192;
const MAX_CHARS = 65535;

function getColorClass(ratio: number): string {
    if (ratio >= 0.95) return 'token-red';
    if (ratio >= 0.80) return 'token-yellow';
    return 'token-green';
}

export function CodeToolbar({ locale, editable }: CodeToolbarProps) {
    const code = useCartStore((s) => s.code);
    const i18nData = useMetaStore((s) => s.i18nData);
    const availableLibs = useLibStore((s) => s.availableLibs);
    const toggleLibPanel = useLibStore((s) => s.toggleLibPanel);
    const libPanelOpen = useLibStore((s) => s.libPanelOpen);
    const { fontCtx } = useFontContext();

    const tokens = useMemo(() => countTokens(code), [code]);
    const chars = useMemo(() => countChars(code), [code]);

    const selectedIds = useMemo(() => parseIncludes(code), [code]);
    const libTokens = useMemo(() => {
        let total = 0;
        for (const id of selectedIds) {
            const lib = availableLibs.find(l => l.id === id);
            if (lib) total += lib.tokenCount;
        }
        return total;
    }, [selectedIds, availableLibs]);
    const libChars = useMemo(() => {
        let total = 0;
        for (const id of selectedIds) {
            const lib = availableLibs.find(l => l.id === id);
            if (lib) total += lib.charCount;
        }
        return total;
    }, [selectedIds, availableLibs]);

    // i18n runtime code stats
    const i18nLua = useMemo(() => {
        if (!i18nData || !i18nData.outputLocale || !i18nData.entries.length) return '';
        return generateI18nLua(i18nData.outputLocale, i18nData, fontCtx);
    }, [i18nData, fontCtx]);
    const i18nTokens = useMemo(() => i18nLua ? countTokens(i18nLua) : 0, [i18nLua]);
    const i18nChars = useMemo(() => i18nLua ? countChars(i18nLua) : 0, [i18nLua]);

    const projectedTokens = tokens + libTokens + i18nTokens;
    const projectedChars = chars + libChars + i18nChars;
    const tokenRatio = projectedTokens / MAX_TOKENS;
    const charRatio = projectedChars / MAX_CHARS;

    return (
        <div className="code-toolbar">
            {editable && availableLibs.length > 0 && (
                <button
                    className={`code-toolbar-btn${libPanelOpen ? ' active' : ''}`}
                    onClick={toggleLibPanel}
                    title={locale.libPanelTitle}
                >
                    Libs{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                </button>
            )}
            <div className="code-toolbar-spacer" />
            <span className={`code-toolbar-stat ${getColorClass(tokenRatio)}`}>
                TOKENS: {projectedTokens}/{MAX_TOKENS}
                {libTokens > 0 && <span className="code-toolbar-lib-delta"> (+{libTokens} lib)</span>}
                {i18nTokens > 0 && <span className="code-toolbar-i18n-delta"> (+{i18nTokens} i18n)</span>}
            </span>
            <span className={`code-toolbar-stat ${getColorClass(charRatio)}`}>
                CHARS: {projectedChars}/{MAX_CHARS}
                {libChars > 0 && <span className="code-toolbar-lib-delta"> (+{libChars} lib)</span>}
                {i18nChars > 0 && <span className="code-toolbar-i18n-delta"> (+{i18nChars} i18n)</span>}
            </span>
        </div>
    );
}
