import { useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import type { LocaleStrings } from '../../types';

const WAVE_COLORS = ['#ff77a8', '#29adff', '#00e436', '#ffec27', '#ff6c24', '#a8e6cf', '#83769c', '#fff1e8'];
const FX_COLORS = ['#333', '#29adff', '#ff77a8', '#ff004d', '#00e436', '#ffa300', '#ffec27', '#a8e6cf'];
const WAVEFORMS = ['sine', 'tri', 'saw', 'sqr', 'pulse', 'ring', 'noise', 'ring2'];
const EFFECTS = ['none', 'slide', 'vib', 'drop', 'fadein', 'fadeout', 'arpF', 'arpS'];

interface SfxToolbarProps {
    locale: LocaleStrings;
    onPushUndo: () => void;
    isPlaying: boolean;
    onTogglePlay: () => void;
}

export function SfxToolbar({ locale, onPushUndo, isPlaying, onTogglePlay }: SfxToolbarProps) {
    const sfxMode = useUIStore((s) => s.sfxMode);
    const setSfxMode = useUIStore((s) => s.setSfxMode);
    const sfxSelectedIndex = useUIStore((s) => s.sfxSelectedIndex);
    const setSfxSelectedIndex = useUIStore((s) => s.setSfxSelectedIndex);
    const sfxSelectedWaveform = useUIStore((s) => s.sfxSelectedWaveform);
    const setSfxSelectedWaveform = useUIStore((s) => s.setSfxSelectedWaveform);
    const sfxSelectedEffect = useUIStore((s) => s.sfxSelectedEffect);
    const setSfxSelectedEffect = useUIStore((s) => s.setSfxSelectedEffect);
    const editable = useUIStore((s) => s.editable);
    const showAudio = useUIStore((s) => s.showAudio);
    const sfx = useCartStore((s) => s.sfx);
    const setSfx = useCartStore((s) => s.setSfx);

    const sfxId = sfxSelectedIndex;
    const speed = sfx[sfxId * 68 + 65] || 0;
    const loopStart = sfx[sfxId * 68 + 66] || 0;
    const loopEnd = sfx[sfxId * 68 + 67] || 0;

    const setSpeed = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(255, v));
        const next = [...sfx];
        next[sfxId * 68 + 65] = clamped;
        setSfx(next);
    }, [sfx, sfxId, setSfx]);

    const setLoopStart = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(31, v));
        const next = [...sfx];
        next[sfxId * 68 + 66] = clamped;
        setSfx(next);
    }, [sfx, sfxId, setSfx]);

    const setLoopEnd = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(31, v));
        const next = [...sfx];
        next[sfxId * 68 + 67] = clamped;
        setSfx(next);
    }, [sfx, sfxId, setSfx]);

    const clearSfx = useCallback(() => {
        onPushUndo();
        const next = [...sfx];
        const offset = sfxId * 68;
        for (let i = 0; i < 64; i++) next[offset + i] = 0;
        next[offset + 65] = 16;
        next[offset + 66] = 0;
        next[offset + 67] = 0;
        setSfx(next);
    }, [sfx, sfxId, setSfx, onPushUndo]);

    const loopLabel = (loopEnd === 0 && loopStart > 0) ? 'LEN' : 'LOOP';

    return (
        <div className="sfx-toolbar">
            {/* Mode toggle */}
            <button
                className={sfxMode === 'bar' ? 'active' : ''}
                title="Bar mode (Tab)"
                onClick={() => setSfxMode('bar')}
            >
                {'\u2581\u2583\u2585\u2587'}
            </button>
            <button
                className={sfxMode === 'tracker' ? 'active' : ''}
                title="Tracker mode (Tab)"
                onClick={() => setSfxMode('tracker')}
            >
                {'\u2261'}
            </button>

            <span className="tool-sep" />

            {/* SFX selector */}
            <button
                title="Previous SFX (-)"
                onClick={() => setSfxSelectedIndex((sfxId - 1 + 64) % 64)}
            >
                {'\u25c0'}
            </button>
            <span className="sfx-val">{sfxId.toString().padStart(2, '0')}</span>
            <button
                title="Next SFX (+)"
                onClick={() => setSfxSelectedIndex((sfxId + 1) % 64)}
            >
                {'\u25b6'}
            </button>

            <span className="tool-sep" />

            {/* Speed */}
            <span className="sfx-label">SPD</span>
            <button
                onClick={() => { if (!editable) return; onPushUndo(); setSpeed(speed - 1); }}
            >
                {'\u25c0'}
            </button>
            <span
                className="sfx-val"
                title="Click to edit, scroll to adjust"
                onWheel={editable ? (e) => {
                    e.preventDefault();
                    onPushUndo();
                    setSpeed(speed + (e.deltaY < 0 ? 1 : -1));
                } : undefined}
            >
                {speed}
            </span>
            <button
                onClick={() => { if (!editable) return; onPushUndo(); setSpeed(speed + 1); }}
            >
                {'\u25b6'}
            </button>

            <span className="tool-sep" />

            {/* Loop */}
            <span className="sfx-label">{loopLabel}</span>
            <button onClick={() => { if (!editable) return; onPushUndo(); setLoopStart(loopStart - 1); }}>{'\u25c0'}</button>
            <span className="sfx-val">{loopStart}</span>
            <button onClick={() => { if (!editable) return; onPushUndo(); setLoopStart(loopStart + 1); }}>{'\u25b6'}</button>
            <button onClick={() => { if (!editable) return; onPushUndo(); setLoopEnd(loopEnd - 1); }}>{'\u25c0'}</button>
            <span className="sfx-val">{loopEnd}</span>
            <button onClick={() => { if (!editable) return; onPushUndo(); setLoopEnd(loopEnd + 1); }}>{'\u25b6'}</button>

            <span className="tool-sep" />

            {/* Waveform selector */}
            <span className="sfx-label">WAV</span>
            {WAVE_COLORS.map((color, i) => (
                <button
                    key={`w${i}`}
                    className={sfxSelectedWaveform === i ? 'active' : ''}
                    style={{ color }}
                    title={WAVEFORMS[i]}
                    onClick={() => setSfxSelectedWaveform(i)}
                >
                    {i}
                </button>
            ))}

            <span className="tool-sep" />

            {/* Effect selector */}
            <span className="sfx-label">FX</span>
            {FX_COLORS.map((color, i) => (
                <button
                    key={`f${i}`}
                    className={sfxSelectedEffect === i ? 'active' : ''}
                    style={{ color }}
                    title={EFFECTS[i]}
                    onClick={() => setSfxSelectedEffect(i)}
                >
                    {i}
                </button>
            ))}

            {editable && (
                <>
                    <span className="tool-sep" />
                    <button
                        title="Clear current SFX"
                        onClick={clearSfx}
                        style={{ color: '#ff004d' }}
                    >
                        CLR
                    </button>
                </>
            )}

            {showAudio && (
                <>
                    <span className="tool-sep" />
                    <button
                        title="Play (Space)"
                        onClick={onTogglePlay}
                    >
                        {isPlaying ? '\u23f9 ' + locale.stop : '\u25b6 ' + locale.play}
                    </button>
                </>
            )}
        </div>
    );
}

export { WAVE_COLORS, FX_COLORS, WAVEFORMS, EFFECTS };
