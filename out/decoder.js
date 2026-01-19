"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pico8Decoder = void 0;
const pngjs_1 = require("pngjs");
const fs = require("fs");
const LUT = "\n 0123456789abcdefghijklmnopqrstuvwxyz!#%(){}[]<>+=/*:;.,~_";
class Pico8Decoder {
    static async decode(pngPath) {
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(pngPath);
            const png = new pngjs_1.PNG();
            stream.pipe(png).on('parsed', function () {
                try {
                    const ram = new Uint8Array(0x8000); // 32k RAM
                    // 1. Extract RAM from PNG steganography
                    // PICO-8 carts are 160x205 usually, but data is in the first 32k bytes.
                    // Each byte comes from one pixel (RGBA 2 bits each).
                    // RAM size 0x8000 (32768) bytes.
                    let byteIndex = 0;
                    for (let y = 0; y < this.height && byteIndex < 0x8000; y++) {
                        for (let x = 0; x < this.width && byteIndex < 0x8000; x++) {
                            const idx = (this.width * y + x) << 2; // R, G, B, A
                            const r = this.data[idx];
                            const g = this.data[idx + 1];
                            const b = this.data[idx + 2];
                            const a = this.data[idx + 3];
                            // PICO-8 byte order is ARGB (A=76, R=54, G=32, B=10)
                            // But wait, the standard spec says:
                            // "Each byte is stored in the 2 least significant bits of the 4 channels of a pixel."
                            // Order: Alpha (MSB), Red, Green, Blue (LSB)
                            // Ref: https://pico-8.fandom.com/wiki/P8PNGFileFormat
                            const byte = ((a & 3) << 6) | ((r & 3) << 4) | ((g & 3) << 2) | (b & 3);
                            ram[byteIndex++] = byte;
                        }
                    }
                    // 2. Extract Code
                    // Code segment starts at 0x4300
                    const codeStart = 0x4300;
                    // Check header
                    if (ram[codeStart] === 0x3a && ram[codeStart + 1] === 0x63 && ram[codeStart + 2] === 0x3a && ram[codeStart + 3] === 0x00) {
                        // Header ":c:\0" -> Legacy Compression
                        resolve(Pico8Decoder.decompressLegacy(ram, codeStart + 4));
                    }
                    else if (ram[codeStart] === 0x00 && ram[codeStart + 1] === 0x70 && ram[codeStart + 2] === 0x78 && ram[codeStart + 3] === 0x61) {
                        // Header "\0pxa" -> New PXA Compression (v0.2.0+)
                        // This is complex (MTF + Unary). For now, return a placeholder or fail gracefully.
                        // Many BBS carts are still legacy or raw text (less common in PNG).
                        // Actually, BBS PNGs often use the new format.
                        // Let's implement basic failure message for now as PXA is complex.
                        resolve("-- PXA Compressed Cartridge (Decompression not yet implemented in this demo)\n-- To view source, open in PICO-8.");
                    }
                    else {
                        // Assuming raw text / uncompressed?
                        // If no specific header, it might be raw ascii text stored in range.
                        // Or it's just raw bytes.
                        // Let's try to interpret as raw ASCII until null terminator or end of section?
                        // However, standard PICO-8 PNGs usually have one of the headers.
                        // Let's try raw read.
                        resolve(Pico8Decoder.readRaw(ram, codeStart));
                    }
                }
                catch (e) {
                    reject(e);
                }
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
    static decompressLegacy(ram, offset) {
        let out = "";
        let inPos = offset;
        const maxPos = 0x8000;
        while (inPos < maxPos) {
            const b = ram[inPos++];
            if (b === 0x00) {
                // Next byte is literal
                if (inPos >= maxPos)
                    break;
                out += String.fromCharCode(ram[inPos++]);
            }
            else if (b < 0x3c) {
                // LUT lookup
                out += LUT[b - 1];
            }
            else {
                // LZSS Copy
                // 2nd byte needed
                if (inPos >= maxPos)
                    break;
                const b2 = ram[inPos++];
                const copyOffset = (b - 0x3c) * 16 + (b2 & 0x0f);
                const copyLength = (b2 >> 4) + 2;
                // Copy from previously emitted output
                // JS strings are immutable so this is inefficient for large data but simple.
                // We need to look back in 'out'.
                if (copyOffset > out.length) {
                    // Invalid backreference? Just ignore or output nothing?
                    // PICO-8 is robust, maybe just zeros.
                }
                else {
                    const startIndex = out.length - copyOffset;
                    for (let i = 0; i < copyLength; i++) {
                        out += out[startIndex + i] || '';
                    }
                }
            }
        }
        return out;
    }
    static readRaw(ram, offset) {
        // Read until 0x00 or end
        let out = "";
        for (let i = offset; i < 0x8000; i++) {
            if (ram[i] === 0)
                break;
            out += String.fromCharCode(ram[i]);
        }
        return out;
    }
}
exports.Pico8Decoder = Pico8Decoder;
//# sourceMappingURL=decoder.js.map