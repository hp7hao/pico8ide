import { describe, it, expect } from 'vitest';
import { parseSfxNotes, packNote, sfxSetNoteField, pitchToNote, NOTE_NAMES } from '../components/sfx/SfxStatusBar';
import type { SfxNote } from '../components/sfx/SfxStatusBar';

describe('pitchToNote', () => {
    it('returns "..." for pitch 0', () => {
        expect(pitchToNote(0)).toBe('...');
    });

    it('converts pitch 1 to C#0 (index 1 in NOTE_NAMES)', () => {
        // pitch 1: 1 % 12 = 1 => NOTE_NAMES[1] = 'C#', octave 0
        expect(pitchToNote(1)).toBe('C#0');
    });

    it('converts pitch 12 to C-1', () => {
        expect(pitchToNote(12)).toBe('C-1');
    });

    it('converts pitch 13 to C#1', () => {
        expect(pitchToNote(13)).toBe('C#1');
    });

    it('converts pitch 24 to C-2', () => {
        expect(pitchToNote(24)).toBe('C-2');
    });

    it('converts pitch 63 to D#5 (max pitch)', () => {
        // 63 / 12 = 5 remainder 3 => D#5
        expect(pitchToNote(63)).toBe('D#5');
    });

    it('NOTE_NAMES has 12 entries', () => {
        expect(NOTE_NAMES).toHaveLength(12);
    });
});

describe('parseSfxNotes', () => {
    it('returns 32 notes for any SFX', () => {
        const sfx = new Array(4352).fill(0);
        const result = parseSfxNotes(sfx, 0);
        expect(result.notes).toHaveLength(32);
    });

    it('parses speed, loopStart, loopEnd from correct offsets', () => {
        const sfx = new Array(4352).fill(0);
        // SFX 0: speed is at offset 65, loopStart at 66, loopEnd at 67
        sfx[65] = 16;
        sfx[66] = 4;
        sfx[67] = 28;
        const result = parseSfxNotes(sfx, 0);
        expect(result.speed).toBe(16);
        expect(result.loopStart).toBe(4);
        expect(result.loopEnd).toBe(28);
    });

    it('detects empty SFX when all volumes are 0', () => {
        const sfx = new Array(4352).fill(0);
        const result = parseSfxNotes(sfx, 0);
        expect(result.isEmpty).toBe(true);
    });

    it('detects non-empty SFX when any note has volume', () => {
        const sfx = new Array(4352).fill(0);
        // Note 0 of SFX 0: set volume to 5 in hi byte
        // hi byte: bit1-3 = volume => 5 << 1 = 10
        sfx[1] = 5 << 1;
        const result = parseSfxNotes(sfx, 0);
        expect(result.isEmpty).toBe(false);
        expect(result.notes[0].volume).toBe(5);
    });

    it('correctly parses pitch from lo byte', () => {
        const sfx = new Array(4352).fill(0);
        // Set pitch to 42 for first note (lo byte, bits 0-5)
        sfx[0] = 42;
        const result = parseSfxNotes(sfx, 0);
        expect(result.notes[0].pitch).toBe(42);
    });

    it('correctly parses waveform across lo and hi bytes', () => {
        const sfx = new Array(4352).fill(0);
        // waveform is 3 bits: lo bits 6-7 (2 low bits) + hi bit 0 (high bit)
        // waveform = 5 = 0b101 => lo bits 6-7 = 0b01, hi bit 0 = 0b1
        sfx[0] = (0b01 << 6);     // lo byte: bits 6-7 = 1
        sfx[1] = 0b1;              // hi byte: bit 0 = 1
        const result = parseSfxNotes(sfx, 0);
        expect(result.notes[0].waveform).toBe(5); // 0b101 = 5
    });

    it('correctly parses effect from hi byte bits 4-6', () => {
        const sfx = new Array(4352).fill(0);
        // effect is bits 4-6 of hi byte => effect 3 = 0b011 << 4 = 48
        sfx[1] = 3 << 4;
        const result = parseSfxNotes(sfx, 0);
        expect(result.notes[0].effect).toBe(3);
    });

    it('handles SFX at non-zero index', () => {
        const sfx = new Array(4352).fill(0);
        // SFX 5: offset = 5*68 = 340. speed at 340+65=405
        sfx[405] = 20;
        const result = parseSfxNotes(sfx, 5);
        expect(result.speed).toBe(20);
    });
});

describe('packNote', () => {
    it('round-trips through parseSfxNotes', () => {
        const note: SfxNote = {
            pitch: 36,
            waveform: 5,
            volume: 7,
            effect: 3,
            customWave: 0,
        };
        const [lo, hi] = packNote(note);

        // Manually parse back
        const pitch = lo & 0x3f;
        const waveform = ((lo >> 6) & 0x03) | ((hi & 0x01) << 2);
        const volume = (hi >> 1) & 0x07;
        const effect = (hi >> 4) & 0x07;

        expect(pitch).toBe(36);
        expect(waveform).toBe(5);
        expect(volume).toBe(7);
        expect(effect).toBe(3);
    });

    it('round-trips all waveform values', () => {
        for (let w = 0; w < 8; w++) {
            const note: SfxNote = { pitch: 24, waveform: w, volume: 4, effect: 0, customWave: 0 };
            const [lo, hi] = packNote(note);
            const parsed = ((lo >> 6) & 0x03) | ((hi & 0x01) << 2);
            expect(parsed).toBe(w);
        }
    });

    it('round-trips all effect values', () => {
        for (let e = 0; e < 8; e++) {
            const note: SfxNote = { pitch: 12, waveform: 0, volume: 1, effect: e, customWave: 0 };
            const [lo, hi] = packNote(note);
            const parsed = (hi >> 4) & 0x07;
            expect(parsed).toBe(e);
        }
    });

    it('preserves customWave bit', () => {
        const note: SfxNote = { pitch: 10, waveform: 2, volume: 3, effect: 1, customWave: 1 };
        const [, hi] = packNote(note);
        expect((hi >> 7) & 0x01).toBe(1);
    });
});

describe('sfxSetNoteField', () => {
    it('changes pitch of a specific note in SFX array', () => {
        const sfx = new Array(4352).fill(0);
        const modified = sfxSetNoteField(sfx, 0, 5, 'pitch', 42);

        const result = parseSfxNotes(modified, 0);
        expect(result.notes[5].pitch).toBe(42);
        // Other notes should be unchanged
        expect(result.notes[4].pitch).toBe(0);
        expect(result.notes[6].pitch).toBe(0);
    });

    it('changes volume of a specific note', () => {
        const sfx = new Array(4352).fill(0);
        const modified = sfxSetNoteField(sfx, 0, 10, 'volume', 7);

        const result = parseSfxNotes(modified, 0);
        expect(result.notes[10].volume).toBe(7);
    });

    it('changes waveform preserving other fields', () => {
        const sfx = new Array(4352).fill(0);
        // Set some data first
        let modified = sfxSetNoteField(sfx, 2, 0, 'pitch', 30);
        modified = sfxSetNoteField(modified, 2, 0, 'volume', 5);
        modified = sfxSetNoteField(modified, 2, 0, 'waveform', 6);

        const result = parseSfxNotes(modified, 2);
        expect(result.notes[0].pitch).toBe(30);
        expect(result.notes[0].volume).toBe(5);
        expect(result.notes[0].waveform).toBe(6);
    });

    it('does not mutate original array', () => {
        const sfx = new Array(4352).fill(0);
        const modified = sfxSetNoteField(sfx, 0, 0, 'pitch', 42);

        // Original unchanged
        expect(sfx[0]).toBe(0);
        // Modified changed
        expect(modified[0]).not.toBe(0);
    });
});
