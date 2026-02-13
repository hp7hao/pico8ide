import type { I18nData } from '../../types';

interface I18nStatusBarProps {
    i18nData: I18nData;
}

export function I18nStatusBar({ i18nData }: I18nStatusBarProps) {
    const totalEntries = i18nData.entries.length;
    const totalLocales = i18nData.locales.length;
    const total = totalEntries * totalLocales;
    let filled = 0;
    for (const entry of i18nData.entries) {
        for (const loc of i18nData.locales) {
            if (entry.translations && entry.translations[loc]) {
                filled++;
            }
        }
    }
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

    return (
        <div className="i18n-status">
            {totalEntries} keys | {totalLocales} locales | {filled}/{total} translations ({pct}%)
        </div>
    );
}
