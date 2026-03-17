import type { Pico8LibMeta, LocaleStrings } from '../../types';

interface LibPickerItemProps {
    lib: Pico8LibMeta;
    selected: boolean;
    onToggle: (id: string) => void;
    locale: LocaleStrings;
}

export function LibPickerItem({ lib, selected, onToggle, locale }: LibPickerItemProps) {
    return (
        <div className={`lib-item${selected ? ' lib-item-selected' : ''}`} onClick={() => onToggle(lib.id)}>
            <div className="lib-item-header">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(lib.id)}
                    onClick={(e) => e.stopPropagation()}
                />
                <span className="lib-item-name">{lib.name}</span>
                <span className="lib-item-tokens">{lib.tokenCount} {locale.libTokens}</span>
            </div>
            <div className="lib-item-desc">{lib.description}</div>
            <div className="lib-item-tags">
                {lib.tags.map(tag => (
                    <span key={tag} className="lib-tag">{tag}</span>
                ))}
                {lib.source === 'workspace' && (
                    <span className="lib-tag lib-tag-workspace">workspace</span>
                )}
            </div>
        </div>
    );
}
