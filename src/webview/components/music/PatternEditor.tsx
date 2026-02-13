import { useCallback, useState } from 'react';
import { parseSfxNotes } from '../sfx/SfxStatusBar';
import { parsePattern } from './PatternNavigator';

interface PatternEditorProps {
    music: number[];
    sfxData: number[];
    currentPattern: number;
    editable: boolean;
    showAudio: boolean;
    onPushUndo: () => void;
    onMusicChange: (music: number[]) => void;
    onPlaySfx: (sfxId: number) => void;
    onStopSfx: () => void;
    playingSfxId: number;
}

export function PatternEditor({
    music,
    sfxData,
    currentPattern,
    editable,
    showAudio,
    onPushUndo,
    onMusicChange,
    onPlaySfx,
    onStopSfx,
    playingSfxId,
}: PatternEditorProps) {
    const [selectedChannel, setSelectedChannel] = useState(0);
    const pat = parsePattern(music, currentPattern);

    const toggleChannel = useCallback((ch: number) => {
        if (!editable) return;
        onPushUndo();
        const next = [...music];
        const offset = currentPattern * 4 + ch;
        if ((next[offset] & 0x40) !== 0) {
            next[offset] = next[offset] & ~0x40;
        } else {
            next[offset] = next[offset] | 0x40;
            if (selectedChannel === ch) setSelectedChannel(-1);
        }
        onMusicChange(next);
    }, [music, currentPattern, editable, selectedChannel, onPushUndo, onMusicChange]);

    const changeSfxId = useCallback((ch: number, delta: number) => {
        if (!editable) return;
        onPushUndo();
        const next = [...music];
        const offset = currentPattern * 4 + ch;
        const cur = next[offset] & 0x3f;
        const flags = next[offset] & 0xc0;
        const newId = ((cur + delta) % 64 + 64) % 64;
        next[offset] = flags | newId;
        onMusicChange(next);
    }, [music, currentPattern, editable, onPushUndo, onMusicChange]);

    const selectSfxForChannel = useCallback((ch: number, sfxIdx: number) => {
        if (!editable || ch < 0 || ch > 3) return;
        onPushUndo();
        const next = [...music];
        const offset = currentPattern * 4 + ch;
        const flags = next[offset] & 0xc0;
        next[offset] = flags | (sfxIdx & 0x3f);
        onMusicChange(next);
    }, [music, currentPattern, editable, onPushUndo, onMusicChange]);

    const toggleFlag = useCallback((chIdx: number, bit: number) => {
        if (!editable) return;
        onPushUndo();
        const next = [...music];
        const offset = currentPattern * 4 + chIdx;
        next[offset] = next[offset] ^ bit;
        onMusicChange(next);
    }, [music, currentPattern, editable, onPushUndo, onMusicChange]);

    // Auto-fix: if selected channel is disabled, pick first enabled
    let effectiveChannel = selectedChannel;
    if (effectiveChannel >= 0 && effectiveChannel <= 3 && pat.disabled[effectiveChannel]) {
        effectiveChannel = -1;
        for (let i = 0; i < 4; i++) {
            if (!pat.disabled[i]) { effectiveChannel = i; break; }
        }
    }

    const currentSfxId = effectiveChannel >= 0 && effectiveChannel <= 3 && !pat.disabled[effectiveChannel]
        ? pat.sfxIds[effectiveChannel]
        : -1;

    return (
        <div className="music-pattern-editor">
            {/* Channel boxes */}
            <div className="music-channels">
                {[0, 1, 2, 3].map((ch) => (
                    <div
                        key={ch}
                        className={`music-ch${pat.disabled[ch] ? ' disabled' : ''}${ch === effectiveChannel ? ' ch-selected' : ''}`}
                        onClick={() => {
                            if (!pat.disabled[ch]) setSelectedChannel(ch);
                        }}
                        style={{ cursor: pat.disabled[ch] ? 'default' : 'pointer' }}
                    >
                        <div className="music-ch-label">
                            {editable && (
                                <input
                                    type="checkbox"
                                    className="music-ch-toggle"
                                    checked={!pat.disabled[ch]}
                                    onChange={() => toggleChannel(ch)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                            {'CH ' + ch}
                        </div>
                        <div className="music-ch-sfx">
                            {editable && !pat.disabled[ch] && (
                                <button onClick={(e) => { e.stopPropagation(); changeSfxId(ch, -1); }}>
                                    {'\u25c0'}
                                </button>
                            )}
                            <span className={`sfx-val${pat.disabled[ch] ? ' muted' : ''}`}>
                                {pat.disabled[ch] ? '--' : pat.sfxIds[ch].toString().padStart(2, '0')}
                            </span>
                            {editable && !pat.disabled[ch] && (
                                <button onClick={(e) => { e.stopPropagation(); changeSfxId(ch, 1); }}>
                                    {'\u25b6'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Flags row */}
            <div className="music-flags">
                <span className="sfx-label" style={{ color: '#888', fontSize: '11px' }}>Flags:</span>
                <button
                    className={`flag-btn${pat.loopStart ? ' loop-start-on' : ''}`}
                    onClick={() => toggleFlag(0, 0x80)}
                >
                    {(pat.loopStart ? '\u25cf ' : '\u25cb ') + 'Loop Start'}
                </button>
                <button
                    className={`flag-btn${pat.loopEnd ? ' loop-end-on' : ''}`}
                    onClick={() => toggleFlag(1, 0x80)}
                >
                    {(pat.loopEnd ? '\u25cf ' : '\u25cb ') + 'Loop End'}
                </button>
                <button
                    className={`flag-btn${pat.stopAtEnd ? ' stop-on' : ''}`}
                    onClick={() => toggleFlag(2, 0x80)}
                >
                    {(pat.stopAtEnd ? '\u25cf ' : '\u25cb ') + 'Stop'}
                </button>
            </div>

            {/* SFX picker */}
            <div className="music-sfx-picker">
                <div className="music-sfx-picker-label">
                    {effectiveChannel >= 0 && effectiveChannel <= 3
                        ? <>SFX for <span className="ch-num">CH {effectiveChannel}</span></>
                        : 'SFX (no channel selected)'}
                </div>
                <div className="music-sfx-grid">
                    {Array.from({ length: 64 }, (_, i) => {
                        const sfxOffset = i * 68;
                        let hasData = false;
                        for (let b = 0; b < 64; b++) {
                            if (sfxData[sfxOffset + b]) { hasData = true; break; }
                        }
                        let cls = 'music-sfx-cell';
                        if (hasData) cls += ' non-empty';
                        if (i === currentSfxId) cls += ' selected';
                        if (i === playingSfxId) cls += ' sfx-playing';
                        return (
                            <div
                                key={i}
                                className={cls}
                                onClick={() => {
                                    if (effectiveChannel >= 0) selectSfxForChannel(effectiveChannel, i);
                                }}
                            >
                                <span>{i.toString().padStart(2, '0')}</span>
                                {showAudio && (
                                    <span
                                        className="sfx-play-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (playingSfxId === i) {
                                                onStopSfx();
                                            } else {
                                                onPlaySfx(i);
                                            }
                                        }}
                                    >
                                        {playingSfxId === i ? '\u23f9' : '\u25b6'}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
