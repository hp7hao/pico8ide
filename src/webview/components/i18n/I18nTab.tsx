import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMetaStore } from '../../store/metaStore';
import { useCartStore } from '../../store/cartStore';
import { useFontContext } from '../../hooks/useFontContext';
import { generateI18nCodegen } from '../../utils/i18nCodegen';
import { I18nToolbar } from './I18nToolbar';
import { TranslationTable } from './TranslationTable';
import { I18nStatusBar } from './I18nStatusBar';
import type { LocaleStrings, I18nData, I18nEntry } from '../../types';

interface I18nTabProps {
    locale: LocaleStrings;
    fontUri: string;
}

export function I18nTab({ locale, fontUri }: I18nTabProps) {
    const i18nData = useMetaStore((s) => s.i18nData);
    const setI18nData = useMetaStore((s) => s.setI18nData);
    const code = useCartStore((s) => s.code);
    const { fontCtx, fontLoaded } = useFontContext();

    const [copyLabel, setCopyLabel] = useState('Copy');
    const [hasScanned, setHasScanned] = useState(false);

    // Ensure we always have a valid i18nData object
    const data: I18nData = useMemo(
        () =>
            i18nData || {
                locales: [],
                entries: [],
                outputLocale: '',
            },
        [i18nData]
    );

    // Auto-scan on first render when we have code.
    // Uses scanCodeSilent (no postMessage) to avoid marking the document dirty on open.
    useEffect(() => {
        if (!hasScanned && fontLoaded && code) {
            // Scan code for tx() keys and merge with existing entries (no postMessage)
            const currentCode = useCartStore.getState().code;
            const re = /tx\(\s*"([^"]+)"\s*(?:,|\))/g;
            let m: RegExpExecArray | null;
            const foundKeys: Record<string, boolean> = {};
            while ((m = re.exec(currentCode)) !== null) {
                foundKeys[m[1]] = true;
            }
            const current: I18nData = useMetaStore.getState().i18nData || {
                locales: [],
                entries: [],
                outputLocale: '',
            };
            // Keep all existing entries (they may use dynamic keys not found by regex)
            const existingKeys: Record<string, boolean> = {};
            current.entries.forEach((e) => { existingKeys[e.key] = true; });
            const newEntries: I18nEntry[] = [...current.entries];
            // Only add newly discovered keys that don't already exist
            for (const k of Object.keys(foundKeys)) {
                if (!existingKeys[k]) {
                    const trans: Record<string, string> = {};
                    current.locales.forEach((loc) => { trans[loc] = ''; });
                    newEntries.push({ key: k, translations: trans });
                }
            }
            // Update store state directly without triggering notifyMetaChanged
            useMetaStore.setState({ i18nData: { ...current, entries: newEntries } });
            setHasScanned(true);
        }
    }, [fontLoaded, code]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateI18nData = useCallback(
        (updater: (prev: I18nData) => I18nData) => {
            const current: I18nData = useMetaStore.getState().i18nData || {
                locales: [],
                entries: [],
                outputLocale: '',
            };
            setI18nData(updater(current));
        },
        [setI18nData]
    );

    const handleScanCode = useCallback(() => {
        const currentCode = useCartStore.getState().code;
        const re = /tx\(\s*"([^"]+)"\s*(?:,|\))/g;
        let m: RegExpExecArray | null;
        const foundKeys: Record<string, boolean> = {};
        while ((m = re.exec(currentCode)) !== null) {
            foundKeys[m[1]] = true;
        }
        updateI18nData((prev) => {
            // Remove entries whose keys no longer exist in code
            const filtered = prev.entries.filter((e) => foundKeys[e.key]);
            // Add new keys
            const existingKeys: Record<string, boolean> = {};
            filtered.forEach((e) => {
                existingKeys[e.key] = true;
            });
            const newEntries: I18nEntry[] = [...filtered];
            for (const k of Object.keys(foundKeys)) {
                if (!existingKeys[k]) {
                    const trans: Record<string, string> = {};
                    prev.locales.forEach((loc) => {
                        trans[loc] = '';
                    });
                    newEntries.push({ key: k, translations: trans });
                }
            }
            return { ...prev, entries: newEntries };
        });
    }, [updateI18nData]);

    const handleAddLocale = useCallback(
        (loc: string) => {
            updateI18nData((prev) => {
                if (prev.locales.indexOf(loc) >= 0) return prev;
                const newLocales = [...prev.locales, loc];
                const newEntries = prev.entries.map((e) => ({
                    ...e,
                    translations: { ...e.translations, [loc]: '' },
                }));
                return {
                    ...prev,
                    locales: newLocales,
                    entries: newEntries,
                    outputLocale: prev.outputLocale || loc,
                };
            });
        },
        [updateI18nData]
    );

    const handleRemoveLocale = useCallback(
        (loc: string) => {
            updateI18nData((prev) => {
                const newLocales = prev.locales.filter((l) => l !== loc);
                const newEntries = prev.entries.map((e) => {
                    const trans = { ...e.translations };
                    delete trans[loc];
                    return { ...e, translations: trans };
                });
                return {
                    ...prev,
                    locales: newLocales,
                    entries: newEntries,
                    outputLocale: prev.outputLocale === loc ? newLocales[0] || '' : prev.outputLocale,
                };
            });
        },
        [updateI18nData]
    );

    const handleOutputLocaleChange = useCallback(
        (loc: string) => {
            updateI18nData((prev) => ({
                ...prev,
                outputLocale: loc,
            }));
        },
        [updateI18nData]
    );

    const handleTranslationChange = useCallback(
        (entryIndex: number, loc: string, value: string) => {
            updateI18nData((prev) => {
                const newEntries = prev.entries.map((e, i) => {
                    if (i !== entryIndex) return e;
                    return {
                        ...e,
                        translations: { ...e.translations, [loc]: value },
                    };
                });
                return { ...prev, entries: newEntries };
            });
        },
        [updateI18nData]
    );

    const handleCopy = useCallback(() => {
        const cg = generateI18nCodegen(data, fontCtx);
        if (cg) {
            navigator.clipboard.writeText(cg.lua).then(() => {
                setCopyLabel('Copied!');
                setTimeout(() => setCopyLabel('Copy'), 1500);
            });
        }
    }, [data, fontCtx]);

    // Generate codegen
    const codegen = useMemo(() => {
        if (!fontLoaded) return null;
        return generateI18nCodegen(data, fontCtx);
    }, [data, fontLoaded, fontCtx]);

    return (
        <div className="i18n-editor">
            <I18nToolbar
                i18nData={data}
                onAddLocale={handleAddLocale}
                onRemoveLocale={handleRemoveLocale}
                onOutputLocaleChange={handleOutputLocaleChange}
                onScanCode={handleScanCode}
            />
            <TranslationTable
                i18nData={data}
                onTranslationChange={handleTranslationChange}
            />
            <div className="i18n-codegen">
                {codegen ? (
                    <>
                        <div className="codegen-header">
                            <span>
                                Generated Lua ({codegen.glyphCount} unique glyphs
                                {codegen.useSwap ? ' (swap mode)' : ''})
                            </span>
                            <button onClick={handleCopy}>{copyLabel}</button>
                        </div>
                        <pre>{codegen.lua}</pre>
                    </>
                ) : (
                    <div className="codegen-header">
                        <span>No output locale selected</span>
                    </div>
                )}
            </div>
            <I18nStatusBar i18nData={data} />
        </div>
    );
}
