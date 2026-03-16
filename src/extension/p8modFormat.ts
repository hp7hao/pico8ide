import { CartData, MetaData } from './cartData';
import { cartDataToP8, p8ToCartData } from './p8format';

/**
 * Serialize CartData + MetaData to .p8mod text format.
 * Standard sections are identical to .p8, with optional __meta__ and __i18n__ JSON sections appended.
 */
export function cartDataToP8Mod(cartData: CartData, metaData: MetaData | null): string {
    // Get standard .p8 content (ends with trailing newline)
    let text = cartDataToP8(cartData);

    if (metaData) {
        if (metaData.meta && (metaData.meta.title || metaData.meta.author || metaData.meta.template !== 'default')) {
            text += '__meta__\n';
            text += JSON.stringify(metaData.meta, null, 2) + '\n';
        }

        if (metaData.i18n && (metaData.i18n.locales.length > 0 || metaData.i18n.entries.length > 0)) {
            text += '__i18n__\n';
            text += JSON.stringify(metaData.i18n, null, 2) + '\n';
        }
    }

    return text;
}

/**
 * Parse .p8mod text format to CartData + MetaData.
 * Splits out __meta__ and __i18n__ JSON sections, delegates the rest to p8ToCartData().
 */
export function p8ModToCartData(text: string): { cartData: CartData; metaData: MetaData | null } {
    // Extract __meta__ and __i18n__ sections and remove them from text before passing to p8ToCartData
    const sectionRegex = /^__(\w+)__$/gm;
    const sections: { name: string; start: number; contentStart: number }[] = [];
    let match;

    while ((match = sectionRegex.exec(text)) !== null) {
        sections.push({
            name: match[1],
            start: match.index,
            contentStart: match.index + match[0].length + 1 // +1 for newline
        });
    }

    let metaJson: string | null = null;
    let i18nJson: string | null = null;
    let standardText = text;

    // Find meta and i18n sections (must be extracted before passing to p8ToCartData)
    const customSections: { name: string; start: number; end: number }[] = [];

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextStart = i + 1 < sections.length ? sections[i + 1].start : text.length;
        const content = text.substring(section.contentStart, nextStart).trim();

        if (section.name === 'meta') {
            metaJson = content;
            customSections.push({ name: 'meta', start: section.start, end: nextStart });
        } else if (section.name === 'i18n') {
            i18nJson = content;
            customSections.push({ name: 'i18n', start: section.start, end: nextStart });
        }
    }

    // Remove custom sections from text (in reverse order to preserve offsets)
    if (customSections.length > 0) {
        customSections.sort((a, b) => b.start - a.start);
        for (const cs of customSections) {
            standardText = standardText.substring(0, cs.start) + standardText.substring(cs.end);
        }
    }

    // Parse standard .p8 sections
    const cartData = p8ToCartData(standardText);

    // Parse JSON sections
    let metaData: MetaData | null = null;

    const parsedMeta = metaJson ? tryParseJson(metaJson) : null;
    const parsedI18n = i18nJson ? tryParseJson(i18nJson) : null;

    if (parsedMeta || parsedI18n) {
        metaData = {
            meta: parsedMeta || { title: '', author: '', template: 'default' },
            i18n: parsedI18n || { locales: [], entries: [], outputLocale: '' }
        };
    }

    return { cartData, metaData };
}

/**
 * Convert a CartData + MetaData into .p8mod text.
 * Convenience alias for cartDataToP8Mod.
 */
export function convertToP8Mod(cartData: CartData, metaData: MetaData | null): string {
    return cartDataToP8Mod(cartData, metaData);
}

/**
 * Generate a blank .p8mod template for new cartridges.
 */
export function blankP8Mod(): string {
    const cartData: CartData = {
        code: '-- new cartridge\n-- use tx() for i18n strings\n\nfunction _init()\n _txi()\n t=0\nend\n\nfunction _update()\n t+=1\nend\n\nfunction _draw()\n cls(1)\n tx("hello",40,60,7)\nend\n',
        gfx: new Array(8192).fill(0),
        map: new Array(4096).fill(0),
        gfxFlags: new Array(256).fill(0),
        music: new Array(256).fill(0),
        sfx: new Array(4352).fill(0),
        label: ''
    };
    const metaData: MetaData = {
        meta: { title: '', author: '', template: 'default' },
        i18n: {
            locales: ['zh'],
            entries: [
                { key: 'hello', translations: { zh: '\u4f60\u597d\u4e16\u754c' } }
            ],
            outputLocale: 'zh'
        }
    };
    return cartDataToP8Mod(cartData, metaData);
}

function tryParseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
