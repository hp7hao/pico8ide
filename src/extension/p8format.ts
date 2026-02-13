import { CartData } from './cartData';

// Encode CartData to .p8 text format
export function cartDataToP8(cartData: CartData): string {
    const lines: string[] = [];
    lines.push('pico-8 cartridge // http://www.pico-8.com');
    lines.push('version 42');

    // __lua__
    lines.push('__lua__');
    // Strip null bytes and other control characters that make VS Code treat the file as binary
    // Keep \n (0x0a), \r (0x0d), \t (0x09), and all printable chars including PICO-8 extended glyphs
    const cleanCode = cartData.code.replace(/\0/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f]/g, '');
    lines.push(cleanCode);

    // __gfx__ - 128 lines x 128 hex chars (nibble-swapped)
    lines.push('__gfx__');
    for (let row = 0; row < 128; row++) {
        let line = '';
        for (let col = 0; col < 64; col++) {
            const byteIdx = row * 64 + col;
            const v = cartData.gfx[byteIdx] || 0;
            // Nibble swap: low nibble first (left pixel), high nibble second (right pixel)
            line += (v & 0x0f).toString(16) + ((v >> 4) & 0x0f).toString(16);
        }
        lines.push(line);
    }

    // __gff__ - 2 lines x 256 hex chars (128 bytes per line, standard hex)
    lines.push('__gff__');
    for (let row = 0; row < 2; row++) {
        let line = '';
        for (let i = 0; i < 128; i++) {
            const byteIdx = row * 128 + i;
            const v = cartData.gfxFlags[byteIdx] || 0;
            line += v.toString(16).padStart(2, '0');
        }
        lines.push(line);
    }

    // __map__ - 32 lines x 256 hex chars (128 cells per line, 2 hex per cell)
    lines.push('__map__');
    for (let row = 0; row < 32; row++) {
        let line = '';
        for (let col = 0; col < 128; col++) {
            const idx = row * 128 + col;
            const v = cartData.map[idx] || 0;
            line += v.toString(16).padStart(2, '0');
        }
        lines.push(line);
    }

    // __sfx__ - 64 lines
    lines.push('__sfx__');
    for (let i = 0; i < 64; i++) {
        const offset = i * 68;

        // Header: editor(1 byte) + speed(1 byte) + loopStart(1 byte) + loopEnd(1 byte) = 8 hex chars
        const editor = cartData.sfx[offset + 64] || 0;
        const speed = cartData.sfx[offset + 65] || 0;
        const loopStart = cartData.sfx[offset + 66] || 0;
        const loopEnd = cartData.sfx[offset + 67] || 0;
        let header = editor.toString(16).padStart(2, '0')
            + speed.toString(16).padStart(2, '0')
            + loopStart.toString(16).padStart(2, '0')
            + loopEnd.toString(16).padStart(2, '0');

        // 32 notes x 5 hex chars each
        // .p8 text format per note: PP W V E (pitch 2 hex, waveform 1 hex, volume 1 hex, effect 1 hex)
        let notesStr = '';
        for (let n = 0; n < 32; n++) {
            const lo = cartData.sfx[offset + n * 2] || 0;
            const hi = cartData.sfx[offset + n * 2 + 1] || 0;

            // Decode note fields from binary RAM format
            const pitch = lo & 0x3f;
            const waveform = ((lo >> 6) & 0x03) | ((hi & 0x01) << 2);
            const volume = (hi >> 1) & 0x07;
            const effect = (hi >> 4) & 0x07;
            const custom = (hi >> 7) & 0x01;

            // Combine custom flag into waveform (custom=1 means waveform 8+)
            const fullWaveform = waveform | (custom << 3);

            // Encode as PICO-8 .p8 text format: pitch(8 bits) | waveform(4 bits) | volume(4 bits) | effect(4 bits)
            const val = (pitch << 12) | (fullWaveform << 8) | (volume << 4) | effect;
            notesStr += val.toString(16).padStart(5, '0');
        }

        lines.push(header + notesStr);
    }

    // __music__ - 64 lines
    lines.push('__music__');
    for (let i = 0; i < 64; i++) {
        const offset = i * 4;
        const ch0 = cartData.music[offset] || 0;
        const ch1 = cartData.music[offset + 1] || 0;
        const ch2 = cartData.music[offset + 2] || 0;
        const ch3 = cartData.music[offset + 3] || 0;

        // Flags from bit 7 of each channel byte
        let flags = 0;
        if (ch0 & 0x80) flags |= 1; // loop start
        if (ch1 & 0x80) flags |= 2; // loop end
        if (ch2 & 0x80) flags |= 4; // stop

        const flagStr = flags.toString(16).padStart(2, '0');

        // Channel values: bit6=disable, bits5:0=sfxId
        // Output as 2 hex chars each, space-separated
        const c0 = (ch0 & 0x7f).toString(16).padStart(2, '0');
        const c1 = (ch1 & 0x7f).toString(16).padStart(2, '0');
        const c2 = (ch2 & 0x7f).toString(16).padStart(2, '0');
        const c3 = (ch3 & 0x7f).toString(16).padStart(2, '0');

        lines.push(`${flagStr} ${c0}${c1}${c2}${c3}`);
    }

    lines.push('');
    return lines.join('\n');
}

// Parse .p8 text format to CartData
export function p8ToCartData(text: string): CartData {
    const sections: { [key: string]: string } = {};
    let currentSection = '';
    const sectionLines: { [key: string]: string[] } = {};

    for (const line of text.split('\n')) {
        const match = line.match(/^__(\w+)__$/);
        if (match) {
            currentSection = match[1];
            sectionLines[currentSection] = [];
        } else if (currentSection) {
            sectionLines[currentSection].push(line);
        }
    }

    // Parse lua code
    const code = (sectionLines['lua'] || []).join('\n');

    // Parse gfx - 128 lines x 128 hex chars (nibble-swapped)
    const gfx = new Array(8192).fill(0);
    const gfxLines = sectionLines['gfx'] || [];
    for (let row = 0; row < Math.min(gfxLines.length, 128); row++) {
        const line = gfxLines[row];
        for (let col = 0; col < 64 && col * 2 + 1 < line.length; col++) {
            const lowNibble = parseInt(line[col * 2], 16);
            const highNibble = parseInt(line[col * 2 + 1], 16);
            // Reverse nibble swap: text "13" -> byte 0x31
            gfx[row * 64 + col] = (highNibble << 4) | lowNibble;
        }
    }

    // Parse gff (gfx flags) - 2 lines x 256 hex chars
    const gfxFlags = new Array(256).fill(0);
    const gffLines = sectionLines['gff'] || [];
    for (let row = 0; row < Math.min(gffLines.length, 2); row++) {
        const line = gffLines[row];
        for (let i = 0; i < 128 && i * 2 + 1 < line.length; i++) {
            gfxFlags[row * 128 + i] = parseInt(line.substr(i * 2, 2), 16);
        }
    }

    // Parse map - 32 lines x 256 hex chars
    const map = new Array(4096).fill(0);
    const mapLines = sectionLines['map'] || [];
    for (let row = 0; row < Math.min(mapLines.length, 32); row++) {
        const line = mapLines[row];
        for (let col = 0; col < 128 && col * 2 + 1 < line.length; col++) {
            map[row * 128 + col] = parseInt(line.substr(col * 2, 2), 16);
        }
    }

    // Parse sfx - 64 lines
    const sfx = new Array(4352).fill(0);
    const sfxLines = sectionLines['sfx'] || [];
    for (let i = 0; i < Math.min(sfxLines.length, 64); i++) {
        const line = sfxLines[i];
        if (line.length < 8) continue;

        const offset = i * 68;

        // Header: 8 hex chars = editor(2) + speed(2) + loopStart(2) + loopEnd(2)
        sfx[offset + 64] = parseInt(line.substr(0, 2), 16);
        sfx[offset + 65] = parseInt(line.substr(2, 2), 16);
        sfx[offset + 66] = parseInt(line.substr(4, 2), 16);
        sfx[offset + 67] = parseInt(line.substr(6, 2), 16);

        // 32 notes x 5 hex chars each starting at position 8
        // .p8 text format per note: PP W V E (pitch 2 hex, waveform 1 hex, volume 1 hex, effect 1 hex)
        for (let n = 0; n < 32; n++) {
            const noteStart = 8 + n * 5;
            if (noteStart + 5 > line.length) break;
            const val = parseInt(line.substr(noteStart, 5), 16);

            // Decode from PICO-8 .p8 text format
            const pitch = (val >> 12) & 0xff;
            const fullWaveform = (val >> 8) & 0x0f;
            const volume = (val >> 4) & 0x0f;
            const effect = val & 0x0f;

            // Split custom flag from waveform (waveform 8+ means custom SFX waveform)
            const waveform = fullWaveform & 0x07;
            const custom = (fullWaveform >> 3) & 0x01;

            // Encode back to binary RAM format (2 bytes per note)
            // lo: ww pppppp (low 6 bits = pitch, bits 6-7 = low 2 bits of waveform)
            // hi: c eee vvv w (bit 0 = high bit of waveform, bits 1-3 = volume, bits 4-6 = effect, bit 7 = custom)
            const lo = (pitch & 0x3f) | ((waveform & 0x03) << 6);
            const hi = ((waveform >> 2) & 0x01) | ((volume & 0x07) << 1) | ((effect & 0x07) << 4) | ((custom & 0x01) << 7);

            sfx[offset + n * 2] = lo;
            sfx[offset + n * 2 + 1] = hi;
        }
    }

    // Parse music - 64 lines
    const music = new Array(256).fill(0);
    const musicLines = sectionLines['music'] || [];
    for (let i = 0; i < Math.min(musicLines.length, 64); i++) {
        const line = musicLines[i].trim();
        if (line.length < 3) continue;

        const offset = i * 4;

        // Format: FF CCCCCCCC  (2 hex flags, space, 4x2 hex channel values)
        const flags = parseInt(line.substr(0, 2), 16);
        const channelStr = line.substr(3).replace(/\s/g, '');

        const c0 = channelStr.length >= 2 ? parseInt(channelStr.substr(0, 2), 16) : 0x41;
        const c1 = channelStr.length >= 4 ? parseInt(channelStr.substr(2, 2), 16) : 0x41;
        const c2 = channelStr.length >= 6 ? parseInt(channelStr.substr(4, 2), 16) : 0x41;
        const c3 = channelStr.length >= 8 ? parseInt(channelStr.substr(6, 2), 16) : 0x41;

        // Restore bit 7 flags: flag bit0 -> ch0 bit7 (loop start), bit1 -> ch1 bit7 (loop end), bit2 -> ch2 bit7 (stop)
        music[offset] = c0 | ((flags & 1) ? 0x80 : 0);
        music[offset + 1] = c1 | ((flags & 2) ? 0x80 : 0);
        music[offset + 2] = c2 | ((flags & 4) ? 0x80 : 0);
        music[offset + 3] = c3;
    }

    return {
        code,
        gfx,
        map,
        gfxFlags,
        music,
        sfx,
        label: '' // .p8 files don't contain label images
    };
}
