import type { LocaleStrings } from '../../types';

const TEMPLATE_NAMES = ['default', 'cyan', 'e-zombie', 'e-zombie16'] as const;

interface TemplatePickerProps {
    locale: LocaleStrings;
    selected: string;
    templatePreviews: Record<string, string>;
    onSelect: (template: string) => void;
}

export function TemplatePicker({ locale, selected, templatePreviews, onSelect }: TemplatePickerProps) {
    return (
        <div>
            <label>{locale.exportTemplate}</label>
            <div className="template-picker">
                {TEMPLATE_NAMES.map((name) => {
                    const preview = templatePreviews[name] || '';
                    return (
                        <div
                            key={name}
                            className={`template-option${selected === name ? ' selected' : ''}`}
                            onClick={() => onSelect(name)}
                        >
                            {preview && <img src={preview} alt={name} />}
                            <span>{name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
