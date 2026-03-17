import { useMemo, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useLibStore } from '../../store/libStore';
import { parseIncludes, insertInclude, removeInclude } from '../../utils/libUtils';
import { LibPickerItem } from './LibPickerItem';
import type { LocaleStrings } from '../../types';

interface LibPickerProps {
    locale: LocaleStrings;
}

export function LibPicker({ locale }: LibPickerProps) {
    const code = useCartStore((s) => s.code);
    const setCode = useCartStore((s) => s.setCode);
    const availableLibs = useLibStore((s) => s.availableLibs);
    const searchQuery = useLibStore((s) => s.searchQuery);
    const setSearchQuery = useLibStore((s) => s.setSearchQuery);

    const selectedIds = useMemo(() => parseIncludes(code), [code]);

    const filteredLibs = useMemo(() => {
        if (!searchQuery) return availableLibs;
        const q = searchQuery.toLowerCase();
        return availableLibs.filter(l =>
            l.name.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q) ||
            l.tags.some(t => t.toLowerCase().includes(q))
        );
    }, [availableLibs, searchQuery]);

    const handleToggle = useCallback((id: string) => {
        if (selectedIds.includes(id)) {
            setCode(removeInclude(code, id));
        } else {
            setCode(insertInclude(code, id));
        }
    }, [code, selectedIds, setCode]);

    const selectedCount = selectedIds.length;
    const totalTokens = useMemo(() => {
        let total = 0;
        for (const id of selectedIds) {
            const lib = availableLibs.find(l => l.id === id);
            if (lib) total += lib.tokenCount;
        }
        return total;
    }, [selectedIds, availableLibs]);
    const totalChars = useMemo(() => {
        let total = 0;
        for (const id of selectedIds) {
            const lib = availableLibs.find(l => l.id === id);
            if (lib) total += lib.charCount;
        }
        return total;
    }, [selectedIds, availableLibs]);

    return (
        <div className="lib-panel">
            <div className="lib-panel-header">{locale.libPanelTitle}</div>
            <input
                type="text"
                className="lib-search"
                placeholder={locale.libSearch}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="lib-panel-list">
                {filteredLibs.length === 0 ? (
                    <div className="lib-no-libs">{locale.libNoLibs}</div>
                ) : (
                    filteredLibs.map(lib => (
                        <LibPickerItem
                            key={lib.id}
                            lib={lib}
                            selected={selectedIds.includes(lib.id)}
                            onToggle={handleToggle}
                            locale={locale}
                        />
                    ))
                )}
            </div>
            {selectedCount > 0 && (
                <div className="lib-summary">
                    {locale.libSelected}: {selectedCount} libs, +{totalTokens} {locale.libTokens}, +{totalChars} {locale.libChars}
                </div>
            )}
        </div>
    );
}
