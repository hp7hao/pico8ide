import { WAVEFORMS, EFFECTS } from './SfxToolbar';

const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

export function pitchToNote(pitch: number): string {
    if (pitch === 0) return '...';
    const octave = Math.floor(pitch / 12);
    const note = pitch % 12;
    return NOTE_NAMES[note] + octave;
}

export interface SfxNote {
    pitch: number;
    waveform: number;
    volume: number;
    effect: number;
    customWave: number;
}

export function parseSfxNotes(sfx: number[], sfxId: number): { notes: SfxNote[]; speed: number; loopStart: number; loopEnd: number; isEmpty: boolean } {
    const offset = sfxId * 68;
    const notes: SfxNote[] = [];
    for (let i = 0; i < 32; i++) {
        const lo = sfx[offset + i * 2] || 0;
        const hi = sfx[offset + i * 2 + 1] || 0;
        notes.push({
            pitch: lo & 0x3f,
            waveform: ((lo >> 6) & 0x03) | ((hi & 0x01) << 2),
            volume: (hi >> 1) & 0x07,
            effect: (hi >> 4) & 0x07,
            customWave: (hi >> 7) & 0x01,
        });
    }
    const speed = sfx[offset + 65] || 0;
    const loopStart = sfx[offset + 66] || 0;
    const loopEnd = sfx[offset + 67] || 0;
    const isEmpty = notes.every((n) => n.volume === 0);
    return { notes, speed, loopStart, loopEnd, isEmpty };
}

export function packNote(note: SfxNote): [number, number] {
    const lo = (note.pitch & 0x3f) | ((note.waveform & 0x03) << 6);
    const hi = ((note.waveform >> 2) & 0x01) | ((note.volume & 0x07) << 1) | ((note.effect & 0x07) << 4) | ((note.customWave & 0x01) << 7);
    return [lo, hi];
}

export function sfxSetNoteField(sfx: number[], sfxId: number, noteIdx: number, field: keyof SfxNote, value: number): number[] {
    const next = [...sfx];
    const offset = sfxId * 68 + noteIdx * 2;
    const lo = next[offset] || 0;
    const hi = next[offset + 1] || 0;
    const note: SfxNote = {
        pitch: lo & 0x3f,
        waveform: ((lo >> 6) & 0x03) | ((hi & 0x01) << 2),
        volume: (hi >> 1) & 0x07,
        effect: (hi >> 4) & 0x07,
        customWave: (hi >> 7) & 0x01,
    };
    (note as any)[field] = value;
    const packed = packNote(note);
    next[offset] = packed[0];
    next[offset + 1] = packed[1];
    return next;
}

interface SfxStatusBarProps {
    hoverNote: number;
    sfxId: number;
    sfx: number[];
    statusMsg: string;
}

export function SfxStatusBar({ hoverNote, sfxId, sfx, statusMsg }: SfxStatusBarProps) {
    let text = `SFX ${sfxId}`;

    if (statusMsg) {
        text = statusMsg;
    } else if (hoverNote >= 0 && hoverNote < 32) {
        const parsed = parseSfxNotes(sfx, sfxId);
        const n = parsed.notes[hoverNote];
        text = `Note: ${hoverNote} | ${pitchToNote(n.pitch)} | ${WAVEFORMS[n.waveform]} | Vol: ${n.volume} | FX: ${EFFECTS[n.effect]}`;
    }

    return (
        <div className="sfx-statusbar">{text}</div>
    );
}

export { NOTE_NAMES };
