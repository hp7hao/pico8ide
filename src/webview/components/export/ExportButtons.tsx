import type { LocaleStrings } from '../../types';

interface ExportButtonsProps {
    locale: LocaleStrings;
    locales: string[];
    statusMessage: string;
    statusColor: string;
    onExportBase: () => void;
    onExportLocale: (loc: string) => void;
    onExportAll: () => void;
}

export function ExportButtons({
    locale,
    locales,
    statusMessage,
    statusColor,
    onExportBase,
    onExportLocale,
    onExportAll,
}: ExportButtonsProps) {
    return (
        <>
            <div className="export-buttons">
                <button onClick={onExportBase}>{locale.exportButton}</button>
                {locales.length > 0 && (
                    <>
                        {locales.map((loc) => (
                            <button
                                key={loc}
                                className="secondary export-locale-btn"
                                onClick={() => onExportLocale(loc)}
                            >
                                {locale.exportLocaleVariant} {loc}.p8.png
                            </button>
                        ))}
                        <button className="secondary" onClick={onExportAll}>
                            {locale.exportAll}
                        </button>
                    </>
                )}
            </div>
            {statusMessage && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: statusColor }}>
                    {statusMessage}
                </div>
            )}
        </>
    );
}
