import { useState, useCallback, useEffect, useRef } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { SfxToolbar } from './SfxToolbar';
import { SfxList } from './SfxList';
import { SfxBarMode } from './SfxBarMode';
import { SfxTrackerMode } from './SfxTrackerMode';
import { SfxStatusBar, parseSfxNotes, sfxSetNoteField } from './SfxStatusBar';
import type { LocaleStrings } from '../../types';

// Audio engine constants
const BASE_FREQ = 65.41;

function pitchToFreq(pitch: number): number {
    return BASE_FREQ * Math.pow(2, pitch / 12);
}

function getOscillatorType(waveform: number): OscillatorType {
    switch (waveform) {
        case 0: return 'sine';
        case 1: return 'triangle';
        case 2: return 'sawtooth';
        case 3: return 'square';
        case 4: return 'square';
        case 5: return 'triangle';
        case 6: return 'sawtooth';
        case 7: return 'sine';
        default: return 'sine';
    }
}

interface SfxPlayer {
    stop: () => void;
}

interface SfxTabProps {
    locale: LocaleStrings;
}

export function SfxTab({ locale }: SfxTabProps) {
    const sfx = useCartStore((s) => s.sfx);
    const setSfx = useCartStore((s) => s.setSfx);
    const sfxMode = useUIStore((s) => s.sfxMode);
    const setSfxMode = useUIStore((s) => s.setSfxMode);
    const sfxId = useUIStore((s) => s.sfxSelectedIndex);
    const setSfxSelectedIndex = useUIStore((s) => s.setSfxSelectedIndex);
    const editable = useUIStore((s) => s.editable);
    const showAudio = useUIStore((s) => s.showAudio);
    const brushWave = useUIStore((s) => s.sfxSelectedWaveform);
    const setBrushWave = useUIStore((s) => s.setSfxSelectedWaveform);
    const brushEffect = useUIStore((s) => s.sfxSelectedEffect);
    const setBrushEffect = useUIStore((s) => s.setSfxSelectedEffect);

    const [hoverNote, setHoverNote] = useState(-1);
    const [hoverArea, setHoverArea] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [playingSfxId, setPlayingSfxId] = useState(-1);
    const [isMainPlaying, setIsMainPlaying] = useState(false);

    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const currentPlayerRef = useRef<SfxPlayer | null>(null);
    const allPlayersRef = useRef<SfxPlayer[]>([]);
    const sfxClipboardRef = useRef<number[] | null>(null);

    // Undo/redo
    const { pushSnapshot, undo, redo } = useUndoRedo<{ id: number; data: number[] }>();

    const pushUndo = useCallback(() => {
        const offset = sfxId * 68;
        pushSnapshot({ id: sfxId, data: sfx.slice(offset, offset + 68) });
    }, [sfxId, sfx, pushSnapshot]);

    const doUndo = useCallback(() => {
        const frame = undo();
        if (!frame) return;
        const next = [...sfx];
        const offset = frame.id * 68;
        for (let i = 0; i < 68; i++) next[offset + i] = frame.data[i];
        setSfx(next);
        useUIStore.getState().setSfxSelectedIndex(frame.id);
    }, [sfx, setSfx, undo]);

    const doRedo = useCallback(() => {
        const frame = redo();
        if (!frame) return;
        const next = [...sfx];
        const offset = frame.id * 68;
        for (let i = 0; i < 68; i++) next[offset + i] = frame.data[i];
        setSfx(next);
        useUIStore.getState().setSfxSelectedIndex(frame.id);
    }, [sfx, setSfx, redo]);

    const showStatus = useCallback((msg: string) => {
        setStatusMsg(msg);
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => setStatusMsg(''), 1500);
    }, []);

    // Audio engine
    const stopAllSfx = useCallback(() => {
        if (currentPlayerRef.current) {
            currentPlayerRef.current.stop();
            currentPlayerRef.current = null;
        }
        allPlayersRef.current.forEach((p) => { try { p.stop(); } catch (_) { } });
        allPlayersRef.current = [];
        setPlayingSfxId(-1);
        setIsMainPlaying(false);
        setHoverNote(-1);
    }, []);

    const playSfxAudio = useCallback((sfxIdToPlay: number, onNoteChange?: (noteIdx: number) => void, skipStop?: boolean): SfxPlayer | null => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (!skipStop) stopAllSfx();

        const parsed = parseSfxNotes(sfx, sfxIdToPlay);
        if (parsed.isEmpty) return null;

        const noteDuration = (parsed.speed || 1) * 183 / 22050;
        let noteIndex = 0;
        let isPlaying = true;
        let oscillator: OscillatorNode | AudioBufferSourceNode | null = null;
        let gainNode: GainNode | null = null;
        const ctx = audioCtxRef.current!;

        function playNote() {
            if (!isPlaying || noteIndex >= 32) {
                if (parsed.loopStart < parsed.loopEnd && isPlaying) {
                    noteIndex = parsed.loopStart;
                } else {
                    isPlaying = false;
                    if (oscillator) { try { oscillator.stop(); } catch (_) { } }
                    return;
                }
            }

            const note = parsed.notes[noteIndex];
            if (onNoteChange) onNoteChange(noteIndex);

            if (note.volume === 0) {
                noteIndex++;
                setTimeout(playNote, noteDuration * 1000);
                return;
            }

            if (note.waveform === 6) {
                // Noise
                const bufferSize = ctx.sampleRate * noteDuration;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                oscillator = source;
            } else {
                const osc = ctx.createOscillator();
                osc.type = getOscillatorType(note.waveform);
                osc.frequency.setValueAtTime(pitchToFreq(note.pitch), ctx.currentTime);
                oscillator = osc;
            }

            gainNode = ctx.createGain();
            const vol = note.volume / 7;
            gainNode.gain.setValueAtTime(vol * 0.3, ctx.currentTime);

            const nextNote = parsed.notes[noteIndex + 1] || note;

            // Apply effects
            if (oscillator instanceof OscillatorNode) {
                switch (note.effect) {
                    case 1: // slide
                        oscillator.frequency.linearRampToValueAtTime(pitchToFreq(nextNote.pitch), ctx.currentTime + noteDuration);
                        break;
                    case 2: { // vibrato
                        const vibratoOsc = ctx.createOscillator();
                        vibratoOsc.frequency.setValueAtTime(6, ctx.currentTime);
                        const vibratoGain = ctx.createGain();
                        vibratoGain.gain.setValueAtTime(pitchToFreq(note.pitch) * 0.02, ctx.currentTime);
                        vibratoOsc.connect(vibratoGain);
                        vibratoGain.connect(oscillator.frequency);
                        vibratoOsc.start();
                        setTimeout(() => { try { vibratoOsc.stop(); } catch (_) { } }, noteDuration * 1000);
                        break;
                    }
                    case 3: // drop
                        oscillator.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + noteDuration);
                        break;
                    case 4: // fade-in
                        gainNode.gain.setValueAtTime(0, ctx.currentTime);
                        gainNode.gain.linearRampToValueAtTime(vol * 0.3, ctx.currentTime + noteDuration);
                        break;
                    case 5: // fade-out
                        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + noteDuration);
                        break;
                    case 6: // arp-fast
                    case 7: { // arp-slow
                        const arpInterval = note.effect === 6 ? 16 : 33;
                        const arpFreqA = pitchToFreq(note.pitch);
                        const arpFreqB = pitchToFreq(nextNote.pitch);
                        let arpToggle = false;
                        const arpEnd = ctx.currentTime + noteDuration;
                        const osc = oscillator;
                        const arpTimer = setInterval(() => {
                            if (!isPlaying || ctx.currentTime >= arpEnd) { clearInterval(arpTimer); return; }
                            try {
                                arpToggle = !arpToggle;
                                (osc as OscillatorNode).frequency.setValueAtTime(arpToggle ? arpFreqB : arpFreqA, ctx.currentTime);
                            } catch (_) { clearInterval(arpTimer); }
                        }, arpInterval);
                        break;
                    }
                }
            }

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.start();
            oscillator.stop(ctx.currentTime + noteDuration);
            noteIndex++;
            setTimeout(playNote, noteDuration * 1000);
        }

        playNote();
        const player: SfxPlayer = {
            stop: () => {
                isPlaying = false;
                if (oscillator) { try { oscillator.stop(); } catch (_) { } }
            },
        };
        allPlayersRef.current.push(player);
        return player;
    }, [sfx, stopAllSfx]);

    const toggleMainPlay = useCallback(() => {
        if (currentPlayerRef.current) {
            stopAllSfx();
        } else {
            const player = playSfxAudio(sfxId, (noteIdx) => {
                setHoverNote(noteIdx);
            });
            if (player) {
                currentPlayerRef.current = player;
                setIsMainPlaying(true);
            }
        }
    }, [sfxId, playSfxAudio, stopAllSfx]);

    const handleListPlay = useCallback((id: number) => {
        stopAllSfx();
        setPlayingSfxId(id);
        const player = playSfxAudio(id, (noteIdx) => {
            setHoverNote(noteIdx);
        });
        if (player) {
            currentPlayerRef.current = player;
            // Auto-stop after duration
            const parsed = parseSfxNotes(sfx, id);
            if (!parsed.isEmpty) {
                const dur = (parsed.speed || 1) * 183 / 22050 * 32;
                setTimeout(() => {
                    setPlayingSfxId((current) => current === id ? -1 : current);
                }, dur * 1000 + 200);
            }
        }
    }, [sfx, playSfxAudio, stopAllSfx]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const uiState = useUIStore.getState();
            if (uiState.activeTab !== 'sfx') return;

            const key = e.key.toLowerCase();

            // Tab: toggle mode (unless in tracker with active row for column cycling)
            if (key === 'tab' && !e.ctrlKey && !e.metaKey) {
                // Let the tracker mode handle Tab for column cycling if in tracker with active row
                if (uiState.sfxMode === 'tracker') {
                    // Don't prevent — let SfxTrackerMode handle it? Actually spec says Tab cycles columns
                    // But only if tracker row is selected, otherwise toggle mode
                    // We handle mode toggle here since tracker keyboard is handled in TrackerMode
                } else {
                    e.preventDefault();
                    setSfxMode('tracker');
                    return;
                }
                e.preventDefault();
                setSfxMode('bar');
                return;
            }

            // Space: play/stop
            if (key === ' ' && !e.ctrlKey && !e.metaKey && showAudio) {
                e.preventDefault();
                toggleMainPlay();
                return;
            }

            // SFX prev/next
            if (key === '-' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setSfxSelectedIndex((uiState.sfxSelectedIndex - 1 + 64) % 64);
                return;
            }
            if (key === '=' || key === '+') {
                e.preventDefault();
                setSfxSelectedIndex((uiState.sfxSelectedIndex + 1) % 64);
                return;
            }

            // Waveform prev/next (q/w) — skip if in tracker mode with active editing
            const inTrkEdit = uiState.sfxMode === 'tracker';
            if (key === 'q' && !e.ctrlKey && !e.metaKey && !inTrkEdit) { e.preventDefault(); setBrushWave((brushWave - 1 + 8) % 8); return; }
            if (key === 'w' && !e.ctrlKey && !e.metaKey && !inTrkEdit) { e.preventDefault(); setBrushWave((brushWave + 1) % 8); return; }

            // Effect prev/next (a/s)
            if (key === 'a' && !e.ctrlKey && !e.metaKey && !inTrkEdit) { e.preventDefault(); setBrushEffect((brushEffect - 1 + 8) % 8); return; }
            if (key === 's' && !e.ctrlKey && !e.metaKey && !inTrkEdit) { e.preventDefault(); setBrushEffect((brushEffect + 1) % 8); return; }

            // Direct waveform selection 1-8
            if (!e.ctrlKey && !e.metaKey && key >= '1' && key <= '8' && !inTrkEdit) {
                e.preventDefault();
                setBrushWave(parseInt(key) - 1);
                return;
            }

            // Undo/redo
            if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey && editable) { e.preventDefault(); doUndo(); return; }
            if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey && editable) { e.preventDefault(); doRedo(); return; }
            if ((e.ctrlKey || e.metaKey) && key === 'y' && editable) { e.preventDefault(); doRedo(); return; }

            // Copy SFX (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && key === 'c') {
                e.preventDefault();
                const offset = uiState.sfxSelectedIndex * 68;
                sfxClipboardRef.current = sfx.slice(offset, offset + 68);
                showStatus('Copied SFX ' + uiState.sfxSelectedIndex);
                return;
            }
            // Paste SFX (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && key === 'v' && editable) {
                e.preventDefault();
                if (!sfxClipboardRef.current) { showStatus('Nothing to paste'); return; }
                pushUndo();
                const next = [...sfx];
                const offset = uiState.sfxSelectedIndex * 68;
                for (let i = 0; i < 68; i++) next[offset + i] = sfxClipboardRef.current[i];
                setSfx(next);
                showStatus('Pasted to SFX ' + uiState.sfxSelectedIndex);
                return;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [sfx, setSfx, editable, showAudio, brushWave, brushEffect, toggleMainPlay, doUndo, doRedo, pushUndo, showStatus, setSfxMode, setSfxSelectedIndex, setBrushWave, setBrushEffect]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            stopAllSfx();
        };
    }, [stopAllSfx]);

    return (
        <div className="sfx-editor">
            <SfxToolbar
                locale={locale}
                onPushUndo={pushUndo}
                isPlaying={isMainPlaying}
                onTogglePlay={toggleMainPlay}
            />
            <div className="sfx-content">
                <SfxList
                    showAudio={showAudio}
                    onPlaySfx={handleListPlay}
                    onStopSfx={stopAllSfx}
                    playingSfxId={playingSfxId}
                />
                <div className="sfx-main">
                    {sfxMode === 'bar' ? (
                        <SfxBarMode
                            hoverNote={hoverNote}
                            onHoverNoteChange={setHoverNote}
                            onHoverAreaChange={setHoverArea}
                            onPushUndo={pushUndo}
                        />
                    ) : (
                        <SfxTrackerMode
                            hoverNote={hoverNote}
                            onHoverNoteChange={setHoverNote}
                            onPushUndo={pushUndo}
                        />
                    )}
                </div>
            </div>
            <SfxStatusBar
                hoverNote={hoverNote}
                sfxId={sfxId}
                sfx={sfx}
                statusMsg={statusMsg}
            />
        </div>
    );
}
