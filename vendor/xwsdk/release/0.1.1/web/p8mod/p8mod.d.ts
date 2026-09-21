/* tslint:disable */
/* eslint-disable */

export class WasmAudioEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Clear post-processing filter, restoring passthrough output.
     */
    clear_post_filter(): void;
    current_music_pattern(): number;
    current_note(channel: number): number;
    current_sfx(channel: number): number;
    fill_buffer_f32(buffer: Float32Array): void;
    fill_buffer_i16(buffer: Int16Array): void;
    is_music_playing(): boolean;
    load_cart(cart: WasmCart): void;
    music(n: number, fade_ms: number, channel_mask: number): void;
    constructor(sample_rate: number);
    reset(): void;
    set_paused(paused: boolean): void;
    /**
     * Set post-processing filter by preset ID: 0=Warm, 1=LoFi, 2=Bright.
     */
    set_post_filter(preset: number): void;
    /**
     * Set a custom post-processing filter.
     */
    set_post_filter_custom(lowpass_cutoff: number, highpass_cutoff: number, bitcrush_bits: number, saturation_drive: number, sample_hold: number): void;
    sfx(n: number, channel: number, offset: number, length: number): void;
}

export class WasmCart {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compress code using LZSS for .p8.png export.
     */
    static compress_lzss(code: string): Uint8Array;
    /**
     * Count characters in code (excluding comments).
     */
    static count_chars(code: string): number;
    /**
     * Count PICO-8 tokens in code string.
     */
    static count_tokens(code: string): number;
    static from_p8(text: string): WasmCart;
    static from_p8_png(data: Uint8Array): WasmCart;
    static from_p8mod(text: string): WasmCart;
    /**
     * Generate i18n Lua runtime code for a locale.
     * glyph_data is an optional flat array of 8 bytes per glyph (bitmap font data).
     * If not provided, uses empty glyph bitmaps.
     */
    generate_i18n_lua(locale: string, glyph_data?: Uint8Array | null): string;
    gfx_data(): Uint8Array;
    gfx_flags_data(): Uint8Array;
    gfx_pixel(x: number, y: number): number;
    i18n_json(): string | undefined;
    label_png(): Uint8Array | undefined;
    /**
     * Auto-detect format from raw bytes and parse.
     */
    static load(data: Uint8Array): WasmCart;
    map_cell(x: number, y: number): number;
    map_data(): Uint8Array;
    meta_json(): string | undefined;
    music_data(): Uint8Array;
    /**
     * Get music pattern as JSON: {channels: [u8;4], channel_enabled: [bool;4], loop_start, loop_end, loop_back}
     */
    music_pattern_json(index: number): string;
    constructor();
    set_gfx_data(data: Uint8Array): void;
    set_gfx_flags_data(data: Uint8Array): void;
    set_gfx_pixel(x: number, y: number, color: number): void;
    set_i18n_json(json: string): void;
    set_label_png(png_data: Uint8Array): void;
    set_map_cell(x: number, y: number, sprite_id: number): void;
    set_map_data(data: Uint8Array): void;
    set_meta_json(json: string): void;
    set_music_data(data: Uint8Array): void;
    /**
     * Set music pattern from JSON.
     */
    set_music_pattern_json(index: number, json: string): void;
    set_sfx_data(data: Uint8Array): void;
    /**
     * Set SFX entry from JSON.
     */
    set_sfx_entry_json(index: number, json: string): void;
    set_sprite_flag(sprite: number, flags: number): void;
    sfx_data(): Uint8Array;
    /**
     * Get SFX entry as JSON: {notes: [{pitch, waveform, volume, effect, custom}×32], filters, speed, loop_start, loop_end}
     */
    sfx_entry_json(index: number): string;
    sprite_flag(sprite: number): number;
    to_p8(): string;
    to_p8_png(cover?: Uint8Array | null): Uint8Array;
    to_p8mod(): string;
    to_playable_exports(cover?: Uint8Array | null): WasmPlayableExports;
    to_playable_p8_png(cover?: Uint8Array | null): Uint8Array;
    code: string;
    readonly version: number;
}

export class WasmPlayableExports {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly p8_source: string;
    readonly png_bytes: Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmaudioengine_free: (a: number, b: number) => void;
    readonly __wbg_wasmcart_free: (a: number, b: number) => void;
    readonly __wbg_wasmplayableexports_free: (a: number, b: number) => void;
    readonly wasmaudioengine_clear_post_filter: (a: number) => void;
    readonly wasmaudioengine_current_music_pattern: (a: number) => number;
    readonly wasmaudioengine_current_note: (a: number, b: number) => number;
    readonly wasmaudioengine_current_sfx: (a: number, b: number) => number;
    readonly wasmaudioengine_fill_buffer_f32: (a: number, b: number, c: number, d: number) => void;
    readonly wasmaudioengine_fill_buffer_i16: (a: number, b: number, c: number, d: number) => void;
    readonly wasmaudioengine_is_music_playing: (a: number) => number;
    readonly wasmaudioengine_load_cart: (a: number, b: number) => void;
    readonly wasmaudioengine_music: (a: number, b: number, c: number, d: number) => void;
    readonly wasmaudioengine_new: (a: number) => number;
    readonly wasmaudioengine_reset: (a: number) => void;
    readonly wasmaudioengine_set_paused: (a: number, b: number) => void;
    readonly wasmaudioengine_set_post_filter: (a: number, b: number, c: number) => void;
    readonly wasmaudioengine_set_post_filter_custom: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasmaudioengine_sfx: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcart_code: (a: number, b: number) => void;
    readonly wasmcart_compress_lzss: (a: number, b: number, c: number) => void;
    readonly wasmcart_count_chars: (a: number, b: number) => number;
    readonly wasmcart_count_tokens: (a: number, b: number) => number;
    readonly wasmcart_from_p8: (a: number, b: number, c: number) => void;
    readonly wasmcart_from_p8_png: (a: number, b: number, c: number) => void;
    readonly wasmcart_from_p8mod: (a: number, b: number, c: number) => void;
    readonly wasmcart_generate_i18n_lua: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasmcart_gfx_data: (a: number, b: number) => void;
    readonly wasmcart_gfx_flags_data: (a: number, b: number) => void;
    readonly wasmcart_gfx_pixel: (a: number, b: number, c: number) => number;
    readonly wasmcart_i18n_json: (a: number, b: number) => void;
    readonly wasmcart_label_png: (a: number, b: number) => void;
    readonly wasmcart_load: (a: number, b: number, c: number) => void;
    readonly wasmcart_map_cell: (a: number, b: number, c: number) => number;
    readonly wasmcart_map_data: (a: number, b: number) => void;
    readonly wasmcart_meta_json: (a: number, b: number) => void;
    readonly wasmcart_music_data: (a: number, b: number) => void;
    readonly wasmcart_music_pattern_json: (a: number, b: number, c: number) => void;
    readonly wasmcart_new: () => number;
    readonly wasmcart_set_code: (a: number, b: number, c: number) => void;
    readonly wasmcart_set_gfx_data: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_gfx_flags_data: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_gfx_pixel: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_i18n_json: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_label_png: (a: number, b: number, c: number) => void;
    readonly wasmcart_set_map_cell: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_map_data: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_meta_json: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_music_data: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_music_pattern_json: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcart_set_sfx_data: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_set_sfx_entry_json: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcart_set_sprite_flag: (a: number, b: number, c: number) => void;
    readonly wasmcart_sfx_data: (a: number, b: number) => void;
    readonly wasmcart_sfx_entry_json: (a: number, b: number, c: number) => void;
    readonly wasmcart_sprite_flag: (a: number, b: number) => number;
    readonly wasmcart_to_p8: (a: number, b: number) => void;
    readonly wasmcart_to_p8_png: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_to_p8mod: (a: number, b: number) => void;
    readonly wasmcart_to_playable_exports: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_to_playable_p8_png: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcart_version: (a: number) => number;
    readonly wasmplayableexports_p8_source: (a: number, b: number) => void;
    readonly wasmplayableexports_png_bytes: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
