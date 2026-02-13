import * as fs from 'fs';
import { PNG } from 'pngjs';
import { CartData } from './cartData';

export class Pico8Decoder {
    static async decode(cartPath: string): Promise<CartData> {
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(cartPath);
            const png = new PNG();

            stream.pipe(png).on('parsed', function(this: any) {
                try {
                    const ram = new Uint8Array(0x8000); // 32k
                    let ramIdx = 0;

                    // Also extract the label image (128x128 visible portion)
                    const labelPng = new PNG({ width: 128, height: 128 });

                    for (let y=0; y<this.height; y++) {
                        for (let x=0; x<this.width; x++) {
                            const idx = (this.width * y + x) << 2;
                            const r = this.data[idx];
                            const g = this.data[idx+1];
                            const b = this.data[idx+2];
                            const a = this.data[idx+3];

                            // Extract RAM data from steganography
                            if (ramIdx < 0x8000) {
                                const byte = ((a & 3) << 6) | ((r & 3) << 4) | ((g & 3) << 2) | (b & 3);
                                ram[ramIdx++] = byte;
                            }

                            // Copy label pixels (128x128 area starting at offset 16,24)
                            const labelX = x - 16;
                            const labelY = y - 24;
                            if (labelX >= 0 && labelX < 128 && labelY >= 0 && labelY < 128) {
                                const labelIdx = (labelY * 128 + labelX) << 2;
                                labelPng.data[labelIdx] = r;
                                labelPng.data[labelIdx + 1] = g;
                                labelPng.data[labelIdx + 2] = b;
                                labelPng.data[labelIdx + 3] = 255;
                            }
                        }
                    }

                    // Convert label to base64 data URL
                    const labelBuffer = PNG.sync.write(labelPng);
                    const label = `data:image/png;base64,${labelBuffer.toString('base64')}`;

                    // Slice Sections
                    const gfx = Array.from(ram.slice(0x0000, 0x2000));
                    const map = Array.from(ram.slice(0x2000, 0x3000));
                    const gfxFlags = Array.from(ram.slice(0x3000, 0x3100));
                    const music = Array.from(ram.slice(0x3100, 0x3200));
                    const sfx = Array.from(ram.slice(0x3200, 0x4300));

                    const codeStart = 0x4300;

                    // Decode Code
                    let code = "";

                    if (ram[codeStart] === 0x3a && ram[codeStart+1] === 0x63 && ram[codeStart+2] === 0x3a && ram[codeStart+3] === 0x00) {
                        // :c: compression (legacy LZSS)
                        // Header: :c:\0 (4 bytes) + codelen (2 bytes big-endian) + 2 zero bytes
                        // Compressed data starts at codeStart + 8
                        const codelen = (ram[codeStart + 4] << 8) | ram[codeStart + 5];
                        code = Pico8Decoder.decompressLZSS(ram.slice(codeStart + 8), codelen);
                    } else if (ram[codeStart] === 0x00 && ram[codeStart+1] === 0x70 && ram[codeStart+2] === 0x78 && ram[codeStart+3] === 0x61) {
                        // \0pxa (new PXA compression)
                        code = Pico8Decoder.decompressPXA(ram.slice(codeStart + 4));
                    } else {
                        // Raw
                        code = Pico8Decoder.readRaw(ram.slice(codeStart));
                    }

                    resolve({
                        code,
                        gfx,
                        map,
                        gfxFlags,
                        music,
                        sfx,
                        label
                    });

                } catch (e) { reject(e); }
            }).on('error', reject);
        });
    }

    private static readRaw(buffer: Uint8Array): string {
        let s = "";
        for (let i=0; i<buffer.length; i++) {
            if (buffer[i] === 0) break;
            s += String.fromCharCode(buffer[i]);
        }
        return s;
    }

    private static decompressLZSS(buffer: Uint8Array, codelen: number): string {
        const LUT = "\n 0123456789abcdefghijklmnopqrstuvwxyz!#%(){}[]<>+=/*:;.,~_";
        let out = "";
        let i = 0;

        while (i < buffer.length && out.length < codelen) {
            const b = buffer[i++];
            if (b === 0x00) {
                // Literal: next byte is a raw character
                if (i >= buffer.length) break;
                out += String.fromCharCode(buffer[i++]);
            } else if (b <= 0x3b) {
                // Dictionary lookup
                out += LUT[b - 1];
            } else {
                // Back-reference: b >= 0x3c
                if (i >= buffer.length) break;
                const b2 = buffer[i++];
                const offset = (b - 0x3c) * 16 + (b2 & 0x0f);
                const length = (b2 >> 4) + 2;

                const start = out.length - offset;
                for (let k = 0; k < length && out.length < codelen; k++) {
                    out += out[start + k];
                }
            }
        }
        return out;
    }

    private static decompressPXA(buffer: Uint8Array): string {
        if (buffer.length < 4) {
            return "-- Empty PXA data";
        }

        const uncompressedLen = (buffer[0] << 8) | buffer[1];

        // Initialize MTF table with identity mapping
        const mtfTable: number[] = [];
        for (let i = 0; i < 256; i++) {
            mtfTable.push(i);
        }

        // Bit reader - LSB to MSB order within each byte
        let bitPos = 0;
        const dataStart = 4;

        const getBit = (): number => {
            const byteIdx = dataStart + (bitPos >> 3);
            if (byteIdx >= buffer.length) return 0;
            const bit = (buffer[byteIdx] >> (bitPos & 7)) & 1;
            bitPos++;
            return bit;
        };

        const getBits = (n: number): number => {
            let val = 0;
            for (let i = 0; i < n; i++) {
                val |= (getBit() << i);
            }
            return val;
        };

        const output: number[] = [];

        while (output.length < uncompressedLen) {
            const headerBit = getBit();

            if (headerBit === 1) {
                // Literal character
                let unary = 0;
                while (getBit() === 1) {
                    unary++;
                }

                const unaryMask = (1 << unary) - 1;
                const index = getBits(4 + unary) + (unaryMask << 4);

                if (index >= 256) break;

                const charCode = mtfTable[index];
                output.push(charCode);

                if (index > 0) {
                    mtfTable.splice(index, 1);
                    mtfTable.unshift(charCode);
                }
            } else {
                // Copy reference
                let offsetBits: number;
                if (getBit() === 0) {
                    offsetBits = 15;
                } else if (getBit() === 0) {
                    offsetBits = 10;
                } else {
                    offsetBits = 5;
                }

                const offset = getBits(offsetBits) + 1;

                if (offsetBits === 10 && offset === 1) {
                    while (output.length < uncompressedLen) {
                        const rawChar = getBits(8);
                        if (rawChar === 0) break;
                        output.push(rawChar);
                    }
                    continue;
                }

                let length = 3;
                let part: number;
                do {
                    part = getBits(3);
                    length += part;
                } while (part === 7);

                if (offset > output.length) {
                    for (let k = 0; k < length && output.length < uncompressedLen; k++) {
                        output.push(0);
                    }
                } else {
                    const start = output.length - offset;
                    for (let k = 0; k < length && output.length < uncompressedLen; k++) {
                        output.push(output[start + k]);
                    }
                }
            }
        }

        return String.fromCharCode(...output);
    }
}

export class Pico8Encoder {
    private static readonly LUT = "\n 0123456789abcdefghijklmnopqrstuvwxyz!#%(){}[]<>+=/*:;.,~_";

    /**
     * Compress code using PICO-8 :c: LZSS format.
     * Returns the full code region bytes (header + compressed data) or null if it doesn't fit.
     */
    static compressLZSS(code: string): Uint8Array | null {
        const LUT = Pico8Encoder.LUT;
        const lutMap: { [ch: string]: number } = {};
        for (let i = 0; i < LUT.length; i++) {
            lutMap[LUT[i]] = i + 1; // 1-based index (0x01..0x3b)
        }

        const out: number[] = [];
        let i = 0;

        while (i < code.length) {
            // Try to find longest back-reference
            // offset range: 1..(0x8000-0x4300-8 area), encoded as (b-0x3c)*16 + (b2 & 0xf)
            // b ranges 0x3c..0xff => (b-0x3c) = 0..195, so offset = 0..195*16+15 = 0..3135
            // length range: 2..17 (encoded as (b2>>4)+2, b2>>4 = 0..15)
            let bestLen = 0;
            let bestOff = 0;
            const maxOff = Math.min(i, 3135);
            const maxLen = Math.min(code.length - i, 17);

            if (maxLen >= 2) {
                for (let off = 1; off <= maxOff; off++) {
                    let len = 0;
                    while (len < maxLen && code[i + len] === code[i - off + (len % off)]) {
                        len++;
                    }
                    if (len > bestLen) {
                        bestLen = len;
                        bestOff = off;
                        if (len === maxLen) { break; }
                    }
                }
            }

            if (bestLen >= 2) {
                // Emit back-reference: 2 bytes
                const b = 0x3c + Math.floor((bestOff) / 16);
                const b2 = ((bestLen - 2) << 4) | ((bestOff) % 16);
                out.push(b);
                out.push(b2);
                i += bestLen;
            } else {
                const ch = code[i];
                if (lutMap[ch] !== undefined) {
                    // Single byte LUT entry
                    out.push(lutMap[ch]);
                } else {
                    // Literal: 0x00 followed by raw byte
                    out.push(0x00);
                    out.push(ch.charCodeAt(0) & 0xFF);
                }
                i++;
            }
        }

        // Header: :c:\0 (4 bytes) + codelen (2 bytes BE) + 2 zero bytes = 8 bytes
        const maxCompressed = 0x8000 - 0x4300 - 8;
        if (out.length > maxCompressed) {
            return null; // doesn't fit even compressed
        }

        const result = new Uint8Array(8 + out.length);
        result[0] = 0x3a; // ':'
        result[1] = 0x63; // 'c'
        result[2] = 0x3a; // ':'
        result[3] = 0x00; // '\0'
        result[4] = (code.length >> 8) & 0xFF; // codelen high byte
        result[5] = code.length & 0xFF;        // codelen low byte
        result[6] = 0x00;
        result[7] = 0x00;
        for (let j = 0; j < out.length; j++) {
            result[8 + j] = out[j];
        }
        return result;
    }

    /**
     * Build a 32KB RAM buffer from CartData sections + code at 0x4300.
     * Uses raw encoding for short code, :c: LZSS compression for longer code.
     */
    static assembleRAM(cartData: CartData, code: string): Uint8Array {
        const ram = new Uint8Array(0x8000); // 32KB zeroed

        // gfx: 0x0000-0x1FFF (8192 bytes)
        for (let i = 0; i < Math.min(cartData.gfx.length, 0x2000); i++) {
            ram[i] = cartData.gfx[i];
        }
        // map: 0x2000-0x2FFF (4096 bytes)
        for (let i = 0; i < Math.min(cartData.map.length, 0x1000); i++) {
            ram[0x2000 + i] = cartData.map[i];
        }
        // gfxFlags: 0x3000-0x30FF (256 bytes)
        for (let i = 0; i < Math.min(cartData.gfxFlags.length, 0x100); i++) {
            ram[0x3000 + i] = cartData.gfxFlags[i];
        }
        // music: 0x3100-0x31FF (256 bytes)
        for (let i = 0; i < Math.min(cartData.music.length, 0x100); i++) {
            ram[0x3100 + i] = cartData.music[i];
        }
        // sfx: 0x3200-0x42FF (4352 bytes)
        for (let i = 0; i < Math.min(cartData.sfx.length, 0x1100); i++) {
            ram[0x3200 + i] = cartData.sfx[i];
        }

        // Code at 0x4300
        const codeStart = 0x4300;
        const maxRawLen = 0x8000 - codeStart - 1; // 15615 bytes + null terminator

        if (code.length <= maxRawLen) {
            // Raw null-terminated
            for (let i = 0; i < code.length; i++) {
                ram[codeStart + i] = code.charCodeAt(i) & 0xFF;
            }
        } else {
            // Use :c: LZSS compression
            const compressed = Pico8Encoder.compressLZSS(code);
            if (compressed) {
                for (let i = 0; i < compressed.length; i++) {
                    ram[codeStart + i] = compressed[i];
                }
            } else {
                // Compressed data doesn't fit either — truncate raw as fallback
                for (let i = 0; i < maxRawLen; i++) {
                    ram[codeStart + i] = code.charCodeAt(i) & 0xFF;
                }
            }
        }

        return ram;
    }

    /**
     * Steganography encode: embed RAM bytes into lower 2 bits of each pixel's RGBA channels.
     * Per pixel, encode one byte:
     *   A bits 1-0: (byte >> 6) & 3
     *   R bits 1-0: (byte >> 4) & 3
     *   G bits 1-0: (byte >> 2) & 3
     *   B bits 1-0: byte & 3
     */
    static encodeSteg(coverPng: PNG, ram: Uint8Array): Buffer {
        let ramIdx = 0;
        for (let y = 0; y < coverPng.height; y++) {
            for (let x = 0; x < coverPng.width; x++) {
                const idx = (coverPng.width * y + x) << 2;
                if (ramIdx < ram.length) {
                    const byte = ram[ramIdx++];
                    // Clear lower 2 bits of each channel, then set from byte
                    coverPng.data[idx]     = (coverPng.data[idx]     & 0xFC) | ((byte >> 4) & 3); // R
                    coverPng.data[idx + 1] = (coverPng.data[idx + 1] & 0xFC) | ((byte >> 2) & 3); // G
                    coverPng.data[idx + 2] = (coverPng.data[idx + 2] & 0xFC) | (byte & 3);        // B
                    coverPng.data[idx + 3] = (coverPng.data[idx + 3] & 0xFC) | ((byte >> 6) & 3); // A
                } else {
                    // Zero out steg bits for remaining pixels
                    coverPng.data[idx]     = coverPng.data[idx]     & 0xFC;
                    coverPng.data[idx + 1] = coverPng.data[idx + 1] & 0xFC;
                    coverPng.data[idx + 2] = coverPng.data[idx + 2] & 0xFC;
                    coverPng.data[idx + 3] = coverPng.data[idx + 3] & 0xFC;
                }
            }
        }
        return PNG.sync.write(coverPng);
    }

    /**
     * Composite label (128x128) onto template at (16,24), render title at (18,166) and
     * author at (18,176) in white using pixel glyph bitmaps.
     * Character advance: 4px for ASCII, 8px for CJK.
     */
    static generateCover(
        templatePath: string,
        labelDataUrl: string,
        title: string,
        author: string,
        glyphs: { [char: string]: number[] }
    ): PNG {
        // Load template PNG
        const templateBuf = fs.readFileSync(templatePath);
        const templateSrc = PNG.sync.read(templateBuf);

        // Create a fresh PNG to avoid pngjs internal stream state issues
        const template = new PNG({ width: templateSrc.width, height: templateSrc.height });
        templateSrc.data.copy(template.data);

        // Decode label from base64 data URL and composite at (16, 24)
        try {
            if (labelDataUrl) {
                const labelBase64 = labelDataUrl.replace(/^data:image\/png;base64,/, '');
                const labelBuf = Buffer.from(labelBase64, 'base64');
                const labelPng = PNG.sync.read(labelBuf);

                for (let ly = 0; ly < Math.min(labelPng.height, 128); ly++) {
                    for (let lx = 0; lx < Math.min(labelPng.width, 128); lx++) {
                        const srcIdx = (ly * labelPng.width + lx) << 2;
                        const dstX = lx + 16;
                        const dstY = ly + 24;
                        if (dstX < template.width && dstY < template.height) {
                            const dstIdx = (dstY * template.width + dstX) << 2;
                            template.data[dstIdx]     = labelPng.data[srcIdx];
                            template.data[dstIdx + 1] = labelPng.data[srcIdx + 1];
                            template.data[dstIdx + 2] = labelPng.data[srcIdx + 2];
                            template.data[dstIdx + 3] = labelPng.data[srcIdx + 3];
                        }
                    }
                }
            }
        } catch {
            // Label decode failed — continue without label compositing
        }

        // Render title text at (18, 166)
        Pico8Encoder.renderTextOnPng(template, title, 18, 166, glyphs);

        // Render author text at (18, 176)
        Pico8Encoder.renderTextOnPng(template, author, 18, 176, glyphs);

        return template;
    }

    /**
     * Blit text onto a PNG using 8x8 glyph bitmaps (LSB = leftmost pixel).
     * ASCII chars advance 4px, non-ASCII advance 8px. White pixels on existing background.
     */
    static renderTextOnPng(
        png: PNG,
        text: string,
        startX: number,
        startY: number,
        glyphs: { [char: string]: number[] }
    ): void {
        let curX = startX;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const isAscii = ch.charCodeAt(0) < 128;
            const advance = isAscii ? 4 : 8;
            const bytes = glyphs[ch];
            if (bytes && bytes.length === 8) {
                for (let row = 0; row < 8; row++) {
                    const b = bytes[row];
                    for (let col = 0; col < 8; col++) {
                        if (b & (1 << col)) {
                            const px = curX + col;
                            const py = startY + row;
                            if (px >= 0 && px < png.width && py >= 0 && py < png.height) {
                                const idx = (py * png.width + px) << 2;
                                png.data[idx]     = 255; // R
                                png.data[idx + 1] = 255; // G
                                png.data[idx + 2] = 255; // B
                                png.data[idx + 3] = 255; // A
                            }
                        }
                    }
                }
            }
            curX += advance;
        }
    }
}
