import { useState, useCallback, useEffect } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { parseSfxNotes, pitchToNote, sfxSetNoteField } from './SfxStatusBar';
import { WAVEFORMS, EFFECTS, WAVE_COLORS, FX_COLORS } from './SfxToolbar';

interface SfxTrackerModeProps {
    hoverNote: number;
    onHoverNoteChange: (note: number) => void;
    onPushUndo: () => void;
}

export function SfxTrackerMode({ hoverNote, onHoverNoteChange, onPushUndo }: SfxTrackerModeProps) {
    const sfx = useCartStore((s) => s.sfx);
    const setSfx = useCartStore((s) => s.setSfx);
    const sfxId = useUIStore((s) => s.sfxSelectedIndex);
    const editable = useUIStore((s) => s.editable);
    const brushWave = useUIStore((s) => s.sfxSelectedWaveform);

    const [trackerRow, setTrackerRow] = useState(-1);
    const [trackerCol, setTrackerCol] = useState(0);

    const parsed = parseSfxNotes(sfx, sfxId);

    const handleRowClick = useCallback((idx: number, col: number) => {
        setTrackerRow(idx);
        setTrackerCol(col);
    }, []);

    // Keyboard handler
    useEffect(() => {
        const sfxMode = useUIStore.getState().sfxMode;
        if (sfxMode !== 'tracker') return;

        const handler = (e: KeyboardEvent) => {
            const uiState = useUIStore.getState();
            if (uiState.sfxMode !== 'tracker') return;
            if (uiState.activeTab !== 'sfx') return;

            const key = e.key.toLowerCase();

            if (trackerRow < 0 || !editable) return;

            // Arrow navigation
            if (key === 'arrowleft') {
                e.preventDefault();
                setTrackerCol(Math.max(0, trackerCol - 1));
                return;
            }
            if (key === 'arrowright') {
                e.preventDefault();
                setTrackerCol(Math.min(3, trackerCol + 1));
                return;
            }

            // Column-specific value editing with Up/Down for non-pitch columns
            if (trackerCol > 0 && (key === 'arrowup' || key === 'arrowdown')) {
                e.preventDefault();
                onPushUndo();
                const n = parseSfxNotes(sfx, sfxId).notes[trackerRow];
                const d = key === 'arrowup' ? 1 : -1;
                let next = sfx;
                if (trackerCol === 1) next = sfxSetNoteField(next, sfxId, trackerRow, 'waveform', Math.max(0, Math.min(7, n.waveform + d)));
                else if (trackerCol === 2) next = sfxSetNoteField(next, sfxId, trackerRow, 'volume', Math.max(0, Math.min(7, n.volume + d)));
                else if (trackerCol === 3) next = sfxSetNoteField(next, sfxId, trackerRow, 'effect', Math.max(0, Math.min(7, n.effect + d)));
                setSfx(next);
                return;
            }

            // Direct numeric entry for non-pitch columns (0-7)
            if (trackerCol > 0 && !e.ctrlKey && !e.metaKey && key >= '0' && key <= '7') {
                e.preventDefault();
                onPushUndo();
                const dv = parseInt(key);
                let next = sfx;
                if (trackerCol === 1) next = sfxSetNoteField(next, sfxId, trackerRow, 'waveform', dv);
                else if (trackerCol === 2) next = sfxSetNoteField(next, sfxId, trackerRow, 'volume', dv);
                else if (trackerCol === 3) next = sfxSetNoteField(next, sfxId, trackerRow, 'effect', dv);
                setSfx(next);
                setTrackerRow(Math.min(31, trackerRow + 1));
                return;
            }

            // Piano key entry for pitch column (col 0)
            if (trackerCol === 0) {
                const pianoMap: Record<string, number> = {
                    'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4,
                    'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
                };
                const pianoMap2: Record<string, number> = {
                    'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16,
                    'r': 17, '5': 18, 't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24,
                };
                let pitch = -1;
                if (pianoMap[key] !== undefined && !e.ctrlKey && !e.metaKey) pitch = pianoMap[key] + 24;
                if (pianoMap2[key] !== undefined && !e.ctrlKey && !e.metaKey) pitch = pianoMap2[key] + 24;
                if (e.shiftKey && pitch >= 0) pitch += 12;
                if (pitch >= 0 && pitch <= 63) {
                    e.preventDefault();
                    onPushUndo();
                    let next = sfxSetNoteField(sfx, sfxId, trackerRow, 'pitch', pitch);
                    next = sfxSetNoteField(next, sfxId, trackerRow, 'waveform', brushWave);
                    const lo = next[sfxId * 68 + trackerRow * 2] || 0;
                    const hi = next[sfxId * 68 + trackerRow * 2 + 1] || 0;
                    const vol = (hi >> 1) & 0x07;
                    if (vol === 0) {
                        next = sfxSetNoteField(next, sfxId, trackerRow, 'volume', 5);
                    }
                    setSfx(next);
                    setTrackerRow(Math.min(31, trackerRow + 1));
                    return;
                }
            }

            if (key === 'backspace' || key === 'delete') {
                e.preventDefault();
                onPushUndo();
                let next = sfxSetNoteField(sfx, sfxId, trackerRow, 'volume', 0);
                next = sfxSetNoteField(next, sfxId, trackerRow, 'pitch', 0);
                setSfx(next);
                return;
            }
            if (key === 'arrowup') { e.preventDefault(); setTrackerRow(Math.max(0, trackerRow - 1)); return; }
            if (key === 'arrowdown') { e.preventDefault(); setTrackerRow(Math.min(31, trackerRow + 1)); return; }
            if (key === 'pageup') { e.preventDefault(); setTrackerRow(Math.max(0, trackerRow - 4)); return; }
            if (key === 'pagedown') { e.preventDefault(); setTrackerRow(Math.min(31, trackerRow + 4)); return; }
            if (key === 'home') { e.preventDefault(); setTrackerRow(0); return; }
            if (key === 'end') { e.preventDefault(); setTrackerRow(31); return; }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [trackerRow, trackerCol, sfx, sfxId, editable, brushWave, setSfx, onPushUndo]);

    return (
        <div className="sfx-tracker-wrap">
            <div className="sfx-tracker">
                <div className="sfx-tracker-header">
                    <span>#</span>
                    <span>Note</span>
                    <span>Wave</span>
                    <span>Vol</span>
                    <span>FX</span>
                </div>
                {parsed.notes.map((n, i) => {
                    const isSelected = i === trackerRow;
                    const isPlaying = i === hoverNote;
                    return (
                        <div
                            key={i}
                            className={`sfx-note${isSelected ? ' selected' : ''}${isPlaying ? ' playing' : ''}`}
                            data-idx={i}
                        >
                            <span className="note-idx">{i.toString().padStart(2, '0')}</span>
                            <span
                                className={`note-pitch${isSelected && trackerCol === 0 ? ' col-active' : ''}`}
                                onClick={() => handleRowClick(i, 0)}
                            >
                                {pitchToNote(n.pitch)}
                            </span>
                            <span
                                className={`note-wave${isSelected && trackerCol === 1 ? ' col-active' : ''}`}
                                style={{ color: WAVE_COLORS[n.waveform] }}
                                onClick={() => handleRowClick(i, 1)}
                            >
                                {n.customWave ? 'C' + n.waveform : WAVEFORMS[n.waveform]}
                            </span>
                            <span
                                className={`note-vol${isSelected && trackerCol === 2 ? ' col-active' : ''}`}
                                onClick={() => handleRowClick(i, 2)}
                            >
                                {n.volume}
                            </span>
                            <span
                                className={`note-fx${isSelected && trackerCol === 3 ? ' col-active' : ''}`}
                                style={{ color: FX_COLORS[n.effect] }}
                                onClick={() => handleRowClick(i, 3)}
                            >
                                {EFFECTS[n.effect]}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
