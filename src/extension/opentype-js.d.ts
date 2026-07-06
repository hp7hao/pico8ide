declare module 'opentype.js' {
    export interface PathCommand {
        type: 'M' | 'L' | 'C' | 'Q' | 'Z';
        x?: number;
        y?: number;
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }

    export interface GlyphPath {
        commands: PathCommand[];
    }

    export interface Glyph {
        getPath(x: number, y: number, fontSize: number): GlyphPath;
    }

    export interface Font {
        charToGlyph(ch: string): Glyph;
    }

    export function parse(buffer: ArrayBuffer | Uint8Array | Buffer, options?: Record<string, unknown>): Font;
}
