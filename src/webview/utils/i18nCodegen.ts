import type { I18nData } from '../types';

/** Render a single character to 8 bytes (LSB=leftmost pixel) using BoutiqueBitmap7x7 font.
 *  Returns { bytes, width } where width is the rightmost lit pixel column + 2 (for spacing). */
export function renderGlyphBytes(
    ch: string,
    ctx: CanvasRenderingContext2D | null
): { bytes: number[]; width: number } {
    if (!ctx) return { bytes: [0, 0, 0, 0, 0, 0, 0, 0], width: 4 };
    ctx.clearRect(0, 0, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '8px BoutiqueBitmap7x7';
    ctx.textBaseline = 'top';
    ctx.fillText(ch, 0, 0);
    const imgData = ctx.getImageData(0, 0, 8, 8);
    const bytes: number[] = [];
    let maxCol = 0;
    for (let row = 0; row < 8; row++) {
        let b = 0;
        for (let col = 0; col < 8; col++) {
            const idx = (row * 8 + col) * 4;
            if (imgData.data[idx] > 128) {
                b |= 1 << col;
                if (col > maxCol) maxCol = col;
            }
        }
        bytes.push(b);
    }
    const width = maxCol + 2;
    return { bytes, width };
}

/** Collect unique printable chars from i18n entries for a given locale */
export function collectI18nChars(i18nData: I18nData, loc: string): { uniqueChars: Record<string, number>; charList: string[] } {
    const uniqueChars: Record<string, number> = {};
    const charList: string[] = [];
    for (const entry of i18nData.entries) {
        const text = (entry.translations && entry.translations[loc]) || '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch !== '\n' && uniqueChars[ch] === undefined) {
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
    const glyphWidths: number[] = [];
    for (const ch of charList) {
        const { bytes, width } = renderGlyphBytes(ch, fontCtx);
        glyphWidths.push(width);
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
        // Mark uniform-width strings with f=1 for fast single-print path
        for (const entry of i18nData.entries) {
            const text = (entry.translations && entry.translations[loc]) || '';
            if (!text) continue;
            let mapped = '';
            let width = 0;
            let uniform = true;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (ch === '\n') {
                    mapped += bslash + 'n';
                } else {
                    const idx = uniqueChars[ch];
                    const code = 128 + idx;
                    mapped += bslash + code.toString();
                    width += glyphWidths[idx];
                    if (glyphWidths[idx] !== 8) uniform = false;
                }
            }
            const extra = uniform ? ',f=1' : '';
            tdLines.push(' ["' + entry.key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]={w=' + width + extra + ',s="' + mapped + '"}');
        }
    } else {
        // Swap mode: store glyph index arrays
        // Each entry is {w=width, g={...}} where values are:
        //   non-negative number = glyph index (0-based into _gd)
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
                } else {
                    const idx = uniqueChars[ch];
                    indices.push(idx.toString());
                    width += glyphWidths[idx];
                }
            }
            tdLines.push(' ["' + entry.key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]={w=' + width + ',g={' + indices.join(',') + '}}');
        }
    }

    let lua = '';
    lua += '-- i18n runtime (generated by pico8ide)' + nl;
    lua += '-- locale: ' + loc + ', ' + charList.length + ' unique glyphs' + nl;
    if (glyphHex.length > 0) {
        lua += '_gd="' + gdStr + '"' + nl;
    }
    if (glyphWidths.length > 0) {
        lua += '_gw={' + glyphWidths.join(',') + '}' + nl;
    }
    lua += '_td={' + nl;
    for (const l of tdLines) {
        lua += l + ',' + nl;
    }
    lua += '}' + nl + nl;

    // Both modes use char-by-char rendering with per-glyph widths
    lua += 'function _txi()' + nl;
    lua += ' poke(0x5600,4)' + nl;
    lua += ' poke(0x5601,8)' + nl;
    lua += ' poke(0x5602,8)' + nl;
    if (!useSwap && glyphHex.length > 0) {
        lua += ' for i=1,#_gd do poke(0x59ff+i,ord(_gd,i)) end' + nl;
    }
    lua += 'end' + nl + nl;

    if (!useSwap) {
        // Direct mode: fast single-print for uniform-width (f=1), char-by-char for mixed
        lua += 'function tx(k,x,y,c)' + nl;
        lua += ' local d=_td[k]' + nl;
        lua += ' if not d then return end' + nl;
        lua += ' if d.f then print("' + p014 + '"..d.s,x,y,c) return end' + nl;
        lua += ' local cx=x' + nl;
        lua += ' for i=1,#d.s do' + nl;
        lua += '  local ch=ord(d.s,i)' + nl;
        lua += '  if ch==10 then cx=x y+=10' + nl;
        lua += '  else' + nl;
        lua += '   print("' + p014 + '"..chr(ch),cx,y,c)' + nl;
        lua += '   cx+=_gw[ch-127]' + nl;
        lua += '  end' + nl;
        lua += ' end' + nl;
        lua += 'end' + nl + nl;
    } else {
        // Swap mode: poke each glyph into slot 128, print char-by-char
        lua += 'function tx(k,x,y,c)' + nl;
        lua += ' local d=_td[k]' + nl;
        lua += ' if not d then return end' + nl;
        lua += ' local cx=x' + nl;
        lua += ' for gi in all(d.g) do' + nl;
        lua += '  if gi==32767 then' + nl;
        lua += '   cx=x y+=10' + nl;
        lua += '  else' + nl;
        lua += '   local o=gi*8+1' + nl;
        lua += '   for j=0,7 do poke(0x5a00+j,ord(_gd,o+j)) end' + nl;
        lua += '   print("' + p014 + bslash + '128",cx,y,c)' + nl;
        lua += '   cx+=_gw[gi+1]' + nl;
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
