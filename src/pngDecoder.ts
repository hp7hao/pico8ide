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
