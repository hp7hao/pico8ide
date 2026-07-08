import type { LocaleStrings } from '../../types';

interface ExportButtonsProps {
    locale: LocaleStrings;
    locales: string[];
    statusMessage: string;
    statusColor: string;
    onExportLocale: (loc: string) => void;
    onExportAll: () => void;
}

export function ExportButtons({
    locale,
    locales,
    statusMessage,
    statusColor,
    onExportLocale,
    onExportAll,
}: ExportButtonsProps) {
    return (
        <>
            <div className="export-buttons">
                <button onClick={onExportAll} disabled={locales.length === 0}>{locale.exportButton}</button>
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
