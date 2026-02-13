import { useState, useCallback } from 'react';
import type { I18nData } from '../../types';

interface I18nToolbarProps {
    i18nData: I18nData;
    onAddLocale: (locale: string) => void;
    onRemoveLocale: (locale: string) => void;
    onOutputLocaleChange: (locale: string) => void;
    onScanCode: () => void;
}

export function I18nToolbar({
    i18nData,
    onAddLocale,
    onRemoveLocale,
    onOutputLocaleChange,
    onScanCode,
}: I18nToolbarProps) {
    const [newLocale, setNewLocale] = useState('');

    const handleAddLocale = useCallback(() => {
        const trimmed = newLocale.trim();
        if (trimmed) {
            onAddLocale(trimmed);
            setNewLocale('');
        }
    }, [newLocale, onAddLocale]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleAddLocale();
            }
        },
        [handleAddLocale]
    );

    return (
        <div className="i18n-toolbar">
            <span style={{ color: '#888', fontSize: '11px' }}>Locales:</span>
            {i18nData.locales.map((loc) => (
                <span key={loc} style={{ color: '#29adff', fontSize: '11px', margin: '0 2px' }}>
                    {loc}
                    <span
                        className="i18n-remove-locale"
                        style={{ color: '#f66', cursor: 'pointer', fontSize: '9px', marginLeft: '2px' }}
                        title="Remove"
                        onClick={() => onRemoveLocale(loc)}
                    >
                        x
                    </span>
                </span>
            ))}
            <div className="tool-sep" />
            <input
                type="text"
                placeholder="e.g. zh_CN"
                style={{ width: '70px' }}
                value={newLocale}
                onChange={(e) => setNewLocale(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button className="tool-btn" onClick={handleAddLocale}>
                + Locale
            </button>
            <div className="tool-sep" />
            <span style={{ color: '#888', fontSize: '11px' }}>Output:</span>
            <select
                value={i18nData.outputLocale || ''}
                onChange={(e) => onOutputLocaleChange(e.target.value)}
            >
                {i18nData.locales.map((loc) => (
                    <option key={loc} value={loc}>
                        {loc}
                    </option>
                ))}
            </select>
            <div className="tool-sep" />
            <button className="tool-btn" onClick={onScanCode}>
                Scan Code
            </button>
        </div>
    );
}
