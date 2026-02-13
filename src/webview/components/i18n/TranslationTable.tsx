import { useCallback } from 'react';
import type { I18nData } from '../../types';

interface TranslationTableProps {
    i18nData: I18nData;
    onTranslationChange: (entryIndex: number, locale: string, value: string) => void;
}

export function TranslationTable({ i18nData, onTranslationChange }: TranslationTableProps) {
    const handleInput = useCallback(
        (idx: number, loc: string, value: string) => {
            onTranslationChange(idx, loc, value);
        },
        [onTranslationChange]
    );

    if (i18nData.entries.length === 0 && i18nData.locales.length === 0) {
        return (
            <div className="i18n-table-wrap">
                <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
                    No i18n entries yet. Add a locale and click &quot;Scan Code&quot; to find tx() calls.
                </div>
            </div>
        );
    }

    return (
        <div className="i18n-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        {i18nData.locales.map((loc) => (
                            <th key={loc}>{loc}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {i18nData.entries.map((entry, idx) => (
                        <tr key={entry.key}>
                            <td className="key-cell" title={entry.key}>
                                {entry.key}
                            </td>
                            {i18nData.locales.map((loc) => {
                                const val = (entry.translations && entry.translations[loc]) || '';
                                return (
                                    <td key={loc}>
                                        <input
                                            className={`i18n-trans-input${!val ? ' empty' : ''}`}
                                            value={val}
                                            onChange={(e) => handleInput(idx, loc, e.target.value)}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
