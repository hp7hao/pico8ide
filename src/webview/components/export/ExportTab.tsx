import { useState, useCallback, useMemo } from 'react';
import { useMetaStore } from '../../store/metaStore';
import { useCartStore } from '../../store/cartStore';
import { useVscodeMessage, postMessage } from '../../hooks/useVscodeMessaging';
import { useFontContext } from '../../hooks/useFontContext';
import { renderGlyphBytes, generateI18nLua } from '../../utils/i18nCodegen';
import { TemplatePicker } from './TemplatePicker';
import { ExportPreview } from './ExportPreview';
import { ExportButtons } from './ExportButtons';
import type { LocaleStrings, I18nData, I18nEntry } from '../../types';

interface ExportTabProps {
    locale: LocaleStrings;
}

function getEntryValue(entries: I18nEntry[], key: string, loc: string): string {
    const e = entries.find(e => e.key === key);
    return e?.translations?.[loc] || '';
}

export function ExportTab({ locale }: ExportTabProps) {
    const meta = useMetaStore((s) => s.meta);
    const i18nData = useMetaStore((s) => s.i18nData);
    const setMetaField = useMetaStore((s) => s.setMetaField);
    const setI18nData = useMetaStore((s) => s.setI18nData);
    const label = useCartStore((s) => s.label);
    const { fontCtx, fontLoaded } = useFontContext();

    const initData = window.__INIT_DATA__;
    const templatePreviews = initData.templatePreviews;

    const [statusMessage, setStatusMessage] = useState('');
    const [statusColor, setStatusColor] = useState('#888');

    const i18n: I18nData = useMemo(
        () =>
            i18nData || {
                locales: [],
                entries: [],
                outputLocale: '',
            },
        [i18nData]
    );

    // Listen for export results from extension
    const handleMessage = useCallback(
        (msg: any) => {
            if (msg.type === 'exportComplete') {
                const fileName = (msg.path || '').split('/').pop()?.split('\\').pop() || '';
                setStatusMessage(locale.exportSuccess + ': ' + fileName);
                setStatusColor('#8f8');
            }
            if (msg.type === 'exportError') {
                setStatusMessage(locale.exportError + ': ' + msg.error);
                setStatusColor('#f66');
            }
            if (msg.type === 'exportBatchComplete') {
                if (msg.errors && msg.errors.length > 0) {
                    setStatusMessage(
                        msg.paths.length + ' exported, ' + msg.errors.length + ' failed: ' + msg.errors.join(', ')
                    );
                    setStatusColor('#fa0');
                } else {
                    setStatusMessage(
                        locale.exportSuccess + ': ' + msg.paths.length + ' files (' + msg.paths.join(', ') + ')'
                    );
                    setStatusColor('#8f8');
                }
            }
        },
        [locale]
    );

    useVscodeMessage(handleMessage);

    const collectGlyphs = useCallback(
        (text: string): Record<string, number[]> => {
            const glyphs: Record<string, number[]> = {};
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (!glyphs[ch]) {
                    glyphs[ch] = renderGlyphBytes(ch, fontCtx);
                }
            }
            return glyphs;
        },
        [fontCtx]
    );

    const getLocaleMeta = useCallback(
        (variant: string) => {
            let locTitle = '';
            let locAuthor = '';
            for (const e of i18n.entries) {
                if (e.key === '_title' && e.translations && e.translations[variant]) {
                    locTitle = e.translations[variant];
                }
                if (e.key === '_author' && e.translations && e.translations[variant]) {
                    locAuthor = e.translations[variant];
                }
            }
            if (locTitle || locAuthor) {
                return {
                    title: locTitle || meta.title,
                    author: locAuthor || meta.author,
                };
            }
            return null;
        },
        [i18n.entries, meta.title, meta.author]
    );

    const handleExportBase = useCallback(() => {
        setStatusMessage('Exporting...');
        setStatusColor('#888');

        const allText = (meta.title || '') + (meta.author || '');
        const glyphs = collectGlyphs(allText);

        postMessage({
            type: 'exportCart',
            variant: 'base',
            glyphs,
            i18nLuaCode: null,
            localeMeta: null,
        });
    }, [meta.title, meta.author, collectGlyphs]);

    const handleExportLocale = useCallback(
        (variant: string) => {
            setStatusMessage('Exporting...');
            setStatusColor('#888');

            const localeMeta = getLocaleMeta(variant);
            const allText = localeMeta
                ? localeMeta.title + localeMeta.author
                : (meta.title || '') + (meta.author || '');
            const glyphs = collectGlyphs(allText);

            const i18nLuaCode = generateI18nLua(variant, i18n, fontCtx);

            postMessage({
                type: 'exportCart',
                variant,
                glyphs,
                i18nLuaCode,
                localeMeta,
            });
        },
        [meta.title, meta.author, i18n, collectGlyphs, getLocaleMeta]
    );

    const handleExportAll = useCallback(() => {
        setStatusMessage('Exporting all...');
        setStatusColor('#888');

        const variants = ['base', ...i18n.locales];
        const items = variants.map((variant) => {
            let localeMeta: { title: string; author: string } | null = null;
            let i18nLuaCode: string | null = null;
            let allText = (meta.title || '') + (meta.author || '');

            if (variant !== 'base') {
                localeMeta = getLocaleMeta(variant);
                if (localeMeta) {
                    allText = localeMeta.title + localeMeta.author;
                }
                i18nLuaCode = generateI18nLua(variant, i18n, fontCtx);
            }

            const glyphs = collectGlyphs(allText);
            return { variant, glyphs, i18nLuaCode, localeMeta };
        });

        postMessage({ type: 'exportCartBatch', items });
    }, [meta.title, meta.author, i18n, collectGlyphs, getLocaleMeta]);

    const handleTemplateSelect = useCallback(
        (template: string) => {
            setMetaField('template', template);
        },
        [setMetaField]
    );

    const handleLocaleMetaChange = useCallback(
        (loc: string, key: '_title' | '_author', value: string) => {
            const data: I18nData = i18nData
                ? { ...i18nData, entries: [...i18nData.entries] }
                : { locales: [], entries: [], outputLocale: '' };
            let idx = data.entries.findIndex((e) => e.key === key);
            if (idx < 0) {
                data.entries.push({ key, translations: {} });
                idx = data.entries.length - 1;
            }
            data.entries[idx] = {
                ...data.entries[idx],
                translations: { ...data.entries[idx].translations, [loc]: value },
            };
            setI18nData(data);
        },
        [i18nData, setI18nData]
    );

    return (
        <div className="export-editor">
            <div className="export-body">
                <div className="export-form">
                    <div>
                        <label>{locale.exportTitle}</label>
                        <input
                            type="text"
                            value={meta.title}
                            placeholder="Game Title"
                            onChange={(e) => setMetaField('title', e.target.value)}
                        />
                    </div>
                    <div>
                        <label>{locale.exportAuthor}</label>
                        <input
                            type="text"
                            value={meta.author}
                            placeholder="Author"
                            onChange={(e) => setMetaField('author', e.target.value)}
                        />
                    </div>
                    {i18n.locales.length > 0 && (
                        <div className="export-locale-meta">
                            <label>Locale Titles &amp; Authors</label>
                            {i18n.locales.map((loc) => (
                                <div key={loc} className="export-locale-meta-row">
                                    <span className="export-locale-tag">{loc}</span>
                                    <input
                                        type="text"
                                        placeholder={meta.title || 'Title'}
                                        value={getEntryValue(i18n.entries, '_title', loc)}
                                        onChange={(e) => handleLocaleMetaChange(loc, '_title', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder={meta.author || 'Author'}
                                        value={getEntryValue(i18n.entries, '_author', loc)}
                                        onChange={(e) => handleLocaleMetaChange(loc, '_author', e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    <TemplatePicker
                        locale={locale}
                        selected={meta.template}
                        templatePreviews={templatePreviews}
                        onSelect={handleTemplateSelect}
                    />
                    <ExportButtons
                        locale={locale}
                        locales={i18n.locales}
                        statusMessage={statusMessage}
                        statusColor={statusColor}
                        onExportBase={handleExportBase}
                        onExportLocale={handleExportLocale}
                        onExportAll={handleExportAll}
                    />
                </div>
                <ExportPreview
                    template={meta.template}
                    title={meta.title}
                    author={meta.author}
                    templatePreviews={templatePreviews}
                    labelDataUrl={label}
                    fontLoaded={fontLoaded}
                />
            </div>
            <div className="export-status">
                {statusMessage && (
                    <span style={{ color: statusColor }}>{statusMessage}</span>
                )}
            </div>
        </div>
    );
}
