import { useState, useCallback, useEffect, useRef } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { MusicToolbar } from './MusicToolbar';
import { PatternEditor } from './PatternEditor';
import { PatternNavigator, parsePattern } from './PatternNavigator';
import { MusicStatusBar } from './MusicStatusBar';
import { parseSfxNotes } from '../sfx/SfxStatusBar';
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

interface MusicPlayer {
    stop: () => void;
}

interface MusicTabProps {
    locale: LocaleStrings;
}

export function MusicTab({ locale }: MusicTabProps) {
    const music = useCartStore((s) => s.music);
    const setMusic = useCartStore((s) => s.setMusic);
    const sfxData = useCartStore((s) => s.sfx);
    const patternIndex = useUIStore((s) => s.musicSelectedPattern);
    const setPatternIndex = useUIStore((s) => s.setMusicSelectedPattern);
    const editable = useUIStore((s) => s.editable);
    const showAudio = useUIStore((s) => s.showAudio);

    const [isPlaying, setIsPlaying] = useState(false);
    const [playingPattern, setPlayingPattern] = useState(0);
    const [playingSfxId, setPlayingSfxId] = useState(-1);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const musicPlayerRef = useRef<MusicPlayer | null>(null);
    const allPlayersRef = useRef<SfxPlayer[]>([]);
    const musicClipboardRef = useRef<number[] | null>(null);
    const musicRef = useRef(music);
    musicRef.current = music;
    const sfxRef = useRef(sfxData);
    sfxRef.current = sfxData;

    // Undo/redo
    const { pushSnapshot, undo, redo } = useUndoRedo<{ pattern: number; data: number[] }>();

    const pushUndo = useCallback(() => {
        const offset = patternIndex * 4;
        pushSnapshot({ pattern: patternIndex, data: [music[offset], music[offset + 1], music[offset + 2], music[offset + 3]] });
    }, [patternIndex, music, pushSnapshot]);

    const doUndo = useCallback(() => {
        const frame = undo();
        if (!frame) return;
        const next = [...music];
        const offset = frame.pattern * 4;
        for (let i = 0; i < 4; i++) next[offset + i] = frame.data[i];
        setMusic(next);
        setPatternIndex(frame.pattern);
    }, [music, setMusic, undo, setPatternIndex]);

    const doRedo = useCallback(() => {
        const frame = redo();
        if (!frame) return;
        const next = [...music];
        const offset = frame.pattern * 4;
        for (let i = 0; i < 4; i++) next[offset + i] = frame.data[i];
        setMusic(next);
        setPatternIndex(frame.pattern);
    }, [music, setMusic, redo, setPatternIndex]);

    // Audio engine
    const stopAllSfx = useCallback(() => {
        allPlayersRef.current.forEach((p) => { try { p.stop(); } catch (_) { } });
        allPlayersRef.current = [];
        setPlayingSfxId(-1);
    }, []);

    const stopMusic = useCallback(() => {
        if (musicPlayerRef.current) {
            musicPlayerRef.current.stop();
            musicPlayerRef.current = null;
        }
        stopAllSfx();
        setIsPlaying(false);
    }, [stopAllSfx]);

    const playSfxAudio = useCallback((sfxIdToPlay: number, onNoteChange?: ((noteIdx: number) => void) | null, skipStop?: boolean): SfxPlayer | null => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (!skipStop) stopAllSfx();

        const parsed = parseSfxNotes(sfxRef.current, sfxIdToPlay);
        if (parsed.isEmpty) return null;

        const noteDuration = (parsed.speed || 1) * 183 / 22050;
        let noteIndex = 0;
        let playing = true;
        let oscillator: OscillatorNode | AudioBufferSourceNode | null = null;
        let gainNode: GainNode | null = null;
        const ctx = audioCtxRef.current!;

        function playNote() {
            if (!playing || noteIndex >= 32) {
                if (parsed.loopStart < parsed.loopEnd && playing) {
                    noteIndex = parsed.loopStart;
                } else {
                    playing = false;
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

            if (oscillator instanceof OscillatorNode) {
                switch (note.effect) {
                    case 1:
                        oscillator.frequency.linearRampToValueAtTime(pitchToFreq(nextNote.pitch), ctx.currentTime + noteDuration);
                        break;
                    case 2: {
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
                    case 3:
                        oscillator.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + noteDuration);
                        break;
                    case 4:
                        gainNode.gain.setValueAtTime(0, ctx.currentTime);
                        gainNode.gain.linearRampToValueAtTime(vol * 0.3, ctx.currentTime + noteDuration);
                        break;
                    case 5:
                        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + noteDuration);
                        break;
                    case 6:
                    case 7: {
                        const arpInterval = note.effect === 6 ? 16 : 33;
                        const arpFreqA = pitchToFreq(note.pitch);
                        const arpFreqB = pitchToFreq(nextNote.pitch);
                        let arpToggle = false;
                        const arpEnd = ctx.currentTime + noteDuration;
                        const osc = oscillator;
                        const arpTimer = setInterval(() => {
                            if (!playing || ctx.currentTime >= arpEnd) { clearInterval(arpTimer); return; }
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
                playing = false;
                if (oscillator) { try { oscillator.stop(); } catch (_) { } }
            },
        };
        allPlayersRef.current.push(player);
        return player;
    }, [stopAllSfx]);

    const playMusicFromPattern = useCallback((startPattern: number) => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        stopMusic();

        let patIdx = startPattern;
        let playing = true;
        const channelPlayers: (SfxPlayer | null)[] = [null, null, null, null];

        function playPattern() {
            if (!playing || patIdx >= 64) {
                stopMusic();
                return;
            }

            // Stop previous channel players
            for (let c = 0; c < 4; c++) {
                if (channelPlayers[c]) {
                    try { channelPlayers[c]!.stop(); } catch (_) { }
                    channelPlayers[c] = null;
                }
            }

            setPlayingPattern(patIdx);

            const m = musicRef.current;
            const offset = patIdx * 4;
            const channels = [m[offset] || 0, m[offset + 1] || 0, m[offset + 2] || 0, m[offset + 3] || 0];
            const allDisabled = channels.every((c) => (c & 0x40) !== 0);
            const loopStart = (channels[0] & 0x80) !== 0;
            const loopEnd = (channels[1] & 0x80) !== 0;
            const stopAtEnd = (channels[2] & 0x80) !== 0;

            if (allDisabled) { stopMusic(); return; }

            let maxDuration = 0;
            for (let ch = 0; ch < 4; ch++) {
                const disabled = (channels[ch] & 0x40) !== 0;
                if (!disabled) {
                    const sfxId = channels[ch] & 0x3f;
                    const sfxParsed = parseSfxNotes(sfxRef.current, sfxId);
                    const nd = (sfxParsed.speed || 1) * 183 / 22050;
                    const sfxDuration = nd * 32;
                    maxDuration = Math.max(maxDuration, sfxDuration);
                    channelPlayers[ch] = playSfxAudio(sfxId, null, true);
                }
            }

            setTimeout(() => {
                if (!playing) return;
                if (stopAtEnd) {
                    stopMusic();
                } else if (loopEnd) {
                    let loopStartIdx = 0;
                    for (let li = patIdx; li >= 0; li--) {
                        if ((musicRef.current[li * 4] & 0x80) !== 0) { loopStartIdx = li; break; }
                    }
                    patIdx = loopStartIdx;
                    playPattern();
                } else {
                    patIdx++;
                    playPattern();
                }
            }, maxDuration * 1000);
        }

        playPattern();
        setIsPlaying(true);
        musicPlayerRef.current = {
            stop: () => {
                playing = false;
                channelPlayers.forEach((p) => { if (p) p.stop(); });
            },
        };
    }, [stopMusic, playSfxAudio]);

    const togglePlay = useCallback(() => {
        if (musicPlayerRef.current) {
            stopMusic();
        } else {
            playMusicFromPattern(patternIndex);
        }
    }, [patternIndex, playMusicFromPattern, stopMusic]);

    const handlePrev = useCallback(() => {
        setPatternIndex((patternIndex + 63) % 64);
    }, [patternIndex, setPatternIndex]);

    const handleNext = useCallback(() => {
        setPatternIndex((patternIndex + 1) % 64);
    }, [patternIndex, setPatternIndex]);

    const handleClear = useCallback(() => {
        pushUndo();
        const next = [...music];
        const offset = patternIndex * 4;
        for (let i = 0; i < 4; i++) next[offset + i] = 0x40;
        setMusic(next);
    }, [music, patternIndex, pushUndo, setMusic]);

    const handleMusicChange = useCallback((next: number[]) => {
        setMusic(next);
    }, [setMusic]);

    const handlePlaySfxInPicker = useCallback((sfxId: number) => {
        stopAllSfx();
        setPlayingSfxId(sfxId);
        playSfxAudio(sfxId, null, false);
        const parsed = parseSfxNotes(sfxData, sfxId);
        if (!parsed.isEmpty) {
            const dur = (parsed.speed || 1) * 183 / 22050 * 32;
            setTimeout(() => {
                setPlayingSfxId((current) => current === sfxId ? -1 : current);
            }, dur * 1000 + 200);
        }
    }, [sfxData, playSfxAudio, stopAllSfx]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const uiState = useUIStore.getState();
            if (uiState.activeTab !== 'music') return;

            if (e.key === 'ArrowLeft' || e.key === '-') {
                e.preventDefault();
                setPatternIndex((uiState.musicSelectedPattern + 63) % 64);
            } else if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') {
                e.preventDefault();
                setPatternIndex((uiState.musicSelectedPattern + 1) % 64);
            } else if (e.key === ' ') {
                e.preventDefault();
                if (showAudio) togglePlay();
            } else if (e.key >= '1' && e.key <= '4' && editable) {
                e.preventDefault();
                const ch = parseInt(e.key) - 1;
                pushUndo();
                const next = [...musicRef.current];
                const offset = uiState.musicSelectedPattern * 4 + ch;
                next[offset] = next[offset] ^ 0x40;
                setMusic(next);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) doRedo();
                else doUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                doRedo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                const cpOff = uiState.musicSelectedPattern * 4;
                musicClipboardRef.current = [music[cpOff], music[cpOff + 1], music[cpOff + 2], music[cpOff + 3]];
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && editable) {
                e.preventDefault();
                if (!musicClipboardRef.current) return;
                pushUndo();
                const next = [...music];
                const psOff = uiState.musicSelectedPattern * 4;
                for (let i = 0; i < 4; i++) next[psOff + i] = musicClipboardRef.current[i];
                setMusic(next);
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && editable) {
                e.preventDefault();
                pushUndo();
                const next = [...music];
                const clOff = uiState.musicSelectedPattern * 4;
                for (let i = 0; i < 4; i++) next[clOff + i] = 0x40;
                setMusic(next);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [music, setMusic, editable, showAudio, togglePlay, doUndo, doRedo, pushUndo, setPatternIndex]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopMusic();
        };
    }, [stopMusic]);

    return (
        <div className="music-editor">
            <MusicToolbar
                locale={locale}
                patternIndex={patternIndex}
                onPrev={handlePrev}
                onNext={handleNext}
                showAudio={showAudio}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                editable={editable}
                onClear={handleClear}
            />
            <div className="music-content">
                <PatternEditor
                    music={music}
                    sfxData={sfxData}
                    currentPattern={patternIndex}
                    editable={editable}
                    showAudio={showAudio}
                    onPushUndo={pushUndo}
                    onMusicChange={handleMusicChange}
                    onPlaySfx={handlePlaySfxInPicker}
                    onStopSfx={stopAllSfx}
                    playingSfxId={playingSfxId}
                />
                <PatternNavigator
                    music={music}
                    currentPattern={patternIndex}
                    playingPattern={playingPattern}
                    isPlaying={isPlaying}
                    onSelectPattern={setPatternIndex}
                />
            </div>
            <MusicStatusBar
                patternIndex={patternIndex}
                playingPattern={playingPattern}
                isPlaying={isPlaying}
                playingPatternLabel={locale.playingPattern || 'Playing pattern'}
            />
        </div>
    );
}
