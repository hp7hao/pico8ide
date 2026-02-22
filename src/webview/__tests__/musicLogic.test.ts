import { describe, it, expect } from 'vitest';
import { parsePattern } from '../components/music/PatternNavigator';

describe('parsePattern', () => {
    it('parses an empty (all disabled) pattern', () => {
        const music = new Array(256).fill(0x40); // all channels disabled
        const pat = parsePattern(music, 0);
        expect(pat.isEmpty).toBe(true);
        expect(pat.disabled).toEqual([true, true, true, true]);
        expect(pat.sfxIds).toEqual([0, 0, 0, 0]);
    });

    it('extracts SFX IDs from lower 6 bits', () => {
        const music = new Array(256).fill(0);
        music[0] = 5;   // ch0 => sfx 5, enabled
        music[1] = 10;  // ch1 => sfx 10, enabled
        music[2] = 63;  // ch2 => sfx 63, enabled
        music[3] = 0x40; // ch3 => disabled
        const pat = parsePattern(music, 0);
        expect(pat.sfxIds).toEqual([5, 10, 63, 0]);
        expect(pat.disabled).toEqual([false, false, false, true]);
        expect(pat.isEmpty).toBe(false);
    });

    it('detects disabled channels via bit 6', () => {
        const music = new Array(256).fill(0);
        music[0] = 0x42; // sfx 2 + disabled
        const pat = parsePattern(music, 0);
        expect(pat.disabled[0]).toBe(true);
        expect(pat.sfxIds[0]).toBe(2);
    });

    it('detects loopStart flag on channel 0 bit 7', () => {
        const music = new Array(256).fill(0x40);
        music[0] = 0x80 | 5; // loopStart + sfx 5, enabled
        const pat = parsePattern(music, 0);
        expect(pat.loopStart).toBe(true);
        expect(pat.loopEnd).toBe(false);
        expect(pat.stopAtEnd).toBe(false);
    });

    it('detects loopEnd flag on channel 1 bit 7', () => {
        const music = new Array(256).fill(0x40);
        music[1] = 0x80 | 3; // loopEnd + sfx 3, enabled
        const pat = parsePattern(music, 0);
        expect(pat.loopEnd).toBe(true);
        expect(pat.loopStart).toBe(false);
    });

    it('detects stopAtEnd flag on channel 2 bit 7', () => {
        const music = new Array(256).fill(0x40);
        music[2] = 0x80 | 7; // stopAtEnd + sfx 7, enabled
        const pat = parsePattern(music, 0);
        expect(pat.stopAtEnd).toBe(true);
    });

    it('handles pattern at non-zero index', () => {
        const music = new Array(256).fill(0x40);
        // Pattern 5: offset = 5*4 = 20
        music[20] = 0x80 | 10; // ch0: loopStart, sfx 10
        music[21] = 0x80 | 20; // ch1: loopEnd, sfx 20
        music[22] = 0x80 | 30; // ch2: stopAtEnd, sfx 30
        music[23] = 0x40 | 0;  // ch3: disabled
        const pat = parsePattern(music, 5);
        expect(pat.sfxIds).toEqual([10, 20, 30, 0]);
        expect(pat.loopStart).toBe(true);
        expect(pat.loopEnd).toBe(true);
        expect(pat.stopAtEnd).toBe(true);
        expect(pat.disabled).toEqual([false, false, false, true]);
    });

    it('isEmpty is true only when ALL channels are disabled', () => {
        const music = new Array(256).fill(0x40);
        // Enable just one channel
        music[3] = 0; // ch3 enabled, sfx 0
        const pat = parsePattern(music, 0);
        expect(pat.isEmpty).toBe(false);
    });

    it('handles boundary: last pattern (index 63)', () => {
        const music = new Array(256).fill(0x40);
        // Pattern 63: offset = 63*4 = 252
        music[252] = 1;
        music[253] = 2;
        music[254] = 3;
        music[255] = 4;
        const pat = parsePattern(music, 63);
        expect(pat.sfxIds).toEqual([1, 2, 3, 4]);
        expect(pat.isEmpty).toBe(false);
    });

    it('preserves SFX ID even when disabled', () => {
        const music = new Array(256).fill(0);
        music[0] = 0x40 | 42; // disabled, sfx 42
        const pat = parsePattern(music, 0);
        expect(pat.disabled[0]).toBe(true);
        expect(pat.sfxIds[0]).toBe(42);
    });
});
