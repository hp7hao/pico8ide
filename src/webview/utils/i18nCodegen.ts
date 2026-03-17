import type { I18nData } from '../types';

function isAscii(ch: string): boolean {
    return ch.charCodeAt(0) < 128;
}

/** Render a single character to 8 bytes (LSB=leftmost pixel) using BoutiqueBitmap7x7 font */
export function renderGlyphBytes(
    ch: string,
    ctx: CanvasRenderingContext2D | null
): number[] {
    if (!ctx) return [0, 0, 0, 0, 0, 0, 0, 0];
    ctx.clearRect(0, 0, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '8px BoutiqueBitmap7x7';
    ctx.textBaseline = 'top';
    ctx.fillText(ch, 0, 0);
    const imgData = ctx.getImageData(0, 0, 8, 8);
    const bytes: number[] = [];
    for (let row = 0; row < 8; row++) {
        let b = 0;
        for (let col = 0; col < 8; col++) {
            const idx = (row * 8 + col) * 4;
            if (imgData.data[idx] > 128) {
                b |= 1 << col;
            }
        }
        bytes.push(b);
    }
    return bytes;
}

/** Collect unique non-ASCII chars from i18n entries for a given locale */
export function collectI18nChars(i18nData: I18nData, loc: string): { uniqueChars: Record<string, number>; charList: string[] } {
    const uniqueChars: Record<string, number> = {};
    const charList: string[] = [];
    for (const entry of i18nData.entries) {
        const text = (entry.translations && entry.translations[loc]) || '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (!isAscii(ch) && uniqueChars[ch] === undefined) {
                uniqueChars[ch] = charList.length;
                charList.push(ch);
            }
        }
    }
    return { uniqueChars, charList };
}

/**
 * Generate the i18n Lua runtime code for a given locale.
 * This produces _txi(), tx(), txw() functions and the translation data table.
 *
 * Two modes based on glyph count:
 * - Direct mode (<=128 glyphs): All glyphs loaded into custom font slots 128-255 at init.
 *   Strings use \128..\255 escape codes directly.
 * - Swap mode (>128 glyphs): Glyphs loaded on-demand before each print.
 *   Translation entries store glyph index arrays instead of raw strings.
 *   tx() iterates the array, pokes each glyph into slot 128, and prints char-by-char.
 */
export function generateI18nLua(
    loc: string,
    i18nData: I18nData,
    fontCtx: CanvasRenderingContext2D | null
): string {
    const { uniqueChars, charList } = collectI18nChars(i18nData, loc);

    let glyphHex = '';
    for (const ch of charList) {
        const bytes = renderGlyphBytes(ch, fontCtx);
        for (const b of bytes) {
            glyphHex += ('0' + b.toString(16)).slice(-2);
        }
    }

    let gdStr = '';
    const bslash = '\\';
    for (let i = 0; i < glyphHex.length; i += 2) {
        gdStr += bslash + 'x' + glyphHex.substr(i, 2);
    }

    const useSwap = charList.length > 128;
    const nl = '\n';
    const p014 = bslash + '014';

    // Build translation data
    const tdLines: string[] = [];
    if (!useSwap) {
        // Direct mode: embed chars 128-255 in strings
        for (const entry of i18nData.entries) {
            const text = (entry.translations && entry.translations[loc]) || '';
            if (!text) continue;
            let mapped = '';
            let width = 0;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (ch === '\n') {
                    mapped += bslash + 'n';
                    // newline doesn't add to width
                } else if (isAscii(ch)) {
                    if (ch === '"') mapped += bslash + '"';
                    else if (ch === bslash) mapped += bslash + bslash;
                    else mapped += ch;
                    width += 4;
                } else {
                    const idx = uniqueChars[ch];
                    const code = 128 + idx;
                    mapped += bslash + code.toString();
                    width += 8;
                }
            }
            tdLines.push(' ' + entry.key + '={w=' + width + ',s="' + mapped + '"}');
        }
    } else {
        // Swap mode: store glyph index arrays
        // Each entry is {w=width, g={...}} where values are:
        //   positive number = glyph index (0-based into _gd)
        //   negative number = ASCII char code (to be printed directly)
        //   32767 = newline sentinel
        for (const entry of i18nData.entries) {
            const text = (entry.translations && entry.translations[loc]) || '';
            if (!text) continue;
            const indices: string[] = [];
            let width = 0;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (ch === '\n') {
                    indices.push('32767');
                    // newline doesn't add to width
                } else if (isAscii(ch)) {
                    indices.push((-ch.charCodeAt(0)).toString());
                    width += 4;
                } else {
                    indices.push(uniqueChars[ch].toString());
                    width += 8;
                }
            }
            tdLines.push(' ' + entry.key + '={w=' + width + ',g={' + indices.join(',') + '}}');
        }
    }

    let lua = '';
    lua += '-- i18n runtime (generated by pico8ide)' + nl;
    lua += '-- locale: ' + loc + ', ' + charList.length + ' unique glyphs' + nl;
    if (glyphHex.length > 0) {
        lua += '_gd="' + gdStr + '"' + nl;
    }
    lua += '_td={' + nl;
    for (const l of tdLines) {
        lua += l + ',' + nl;
    }
    lua += '}' + nl + nl;

    if (!useSwap) {
        lua += 'function _txi()' + nl;
        lua += ' poke(0x5600,4)' + nl;
        lua += ' poke(0x5601,8)' + nl;
        lua += ' poke(0x5602,8)' + nl;
        if (glyphHex.length > 0) {
            lua += ' for i=1,#_gd do poke(0x59ff+i,ord(_gd,i)) end' + nl;
        }
        lua += 'end' + nl + nl;
        lua += 'function tx(k,x,y,c)' + nl;
        lua += ' local d=_td[k]' + nl;
        lua += ' if(d)print("' + p014 + '"..d.s,x,y,c)' + nl;
        lua += 'end' + nl + nl;
    } else {
        // Swap mode: tx() iterates glyph array, pokes each into slot 128, prints char-by-char
        lua += 'function _txi()' + nl;
        lua += ' poke(0x5600,4)' + nl;
        lua += ' poke(0x5601,8)' + nl;
        lua += ' poke(0x5602,8)' + nl;
        lua += 'end' + nl + nl;
        lua += 'function tx(k,x,y,c)' + nl;
        lua += ' local d=_td[k]' + nl;
        lua += ' if not d then return end' + nl;
        lua += ' local cx=x' + nl;
        lua += ' local cy=y' + nl;
        lua += ' for gi in all(d.g) do' + nl;
        lua += '  if gi==32767 then' + nl;
        lua += '   cx=x cy+=10' + nl;
        lua += '  elseif gi<0 then' + nl;
        lua += '   print(chr(-gi),cx,cy,c)' + nl;
        lua += '   cx+=4' + nl;
        lua += '  else' + nl;
        lua += '   local o=gi*8+1' + nl;
        lua += '   for j=0,7 do poke(0x5a00+j,ord(_gd,o+j)) end' + nl;
        lua += '   print("' + p014 + bslash + '128",cx,cy,c)' + nl;
        lua += '   cx+=8' + nl;
        lua += '  end' + nl;
        lua += ' end' + nl;
        lua += 'end' + nl + nl;
    }
    lua += 'function txw(k)' + nl;
    lua += ' local d=_td[k]' + nl;
    lua += ' return d and d.w or 0' + nl;
    lua += 'end' + nl;

    return lua;
}

/**
 * Generate i18n codegen with metadata (used by I18nTab for preview).
 */
export function generateI18nCodegen(
    i18nData: I18nData,
    fontCtx: CanvasRenderingContext2D | null
): { lua: string; glyphCount: number; useSwap: boolean } | null {
    const loc = i18nData.outputLocale;
    if (!loc) return null;
    const lua = generateI18nLua(loc, i18nData, fontCtx);
    const { charList } = collectI18nChars(i18nData, loc);
    return { lua, glyphCount: charList.length, useSwap: charList.length > 128 };
}
