import { useCallback } from 'react';
import { parsePattern } from './PatternNavigator';

interface PatternEditorProps {
    music: number[];
    currentPattern: number;
    editable: boolean;
    selectedChannel: number;
    onSelectChannel: (ch: number) => void;
    onMusicChange: (music: number[]) => void;
}

export function getEffectiveChannel(music: number[], currentPattern: number, selectedChannel: number): number {
    const pat = parsePattern(music, currentPattern);
    let effectiveChannel = selectedChannel;
    if (effectiveChannel >= 0 && effectiveChannel <= 3 && pat.disabled[effectiveChannel]) {
        effectiveChannel = -1;
        for (let i = 0; i < 4; i++) {
            if (!pat.disabled[i]) { effectiveChannel = i; break; }
        }
    }
    return effectiveChannel;
}

export function PatternEditor({
    music,
    currentPattern,
    editable,
    selectedChannel,
    onSelectChannel,
    onMusicChange,
}: PatternEditorProps) {
    const pat = parsePattern(music, currentPattern);

    const toggleChannel = useCallback((ch: number) => {
        if (!editable) return;
        const next = [...music];
        const offset = currentPattern * 4 + ch;
        if ((next[offset] & 0x40) !== 0) {
            next[offset] = next[offset] & ~0x40;
        } else {
            next[offset] = next[offset] | 0x40;
            if (selectedChannel === ch) onSelectChannel(-1);
        }
        onMusicChange(next);
    }, [music, currentPattern, editable, selectedChannel, onMusicChange, onSelectChannel]);

    const changeSfxId = useCallback((ch: number, delta: number) => {
        if (!editable) return;
        const next = [...music];
        const offset = currentPattern * 4 + ch;
        const cur = next[offset] & 0x3f;
        const flags = next[offset] & 0xc0;
        const newId = ((cur + delta) % 64 + 64) % 64;
        next[offset] = flags | newId;
        onMusicChange(next);
    }, [music, currentPattern, editable, onMusicChange]);

    const toggleFlag = useCallback((chIdx: number, bit: number) => {
        if (!editable) return;
        const next = [...music];
        const offset = currentPattern * 4 + chIdx;
        next[offset] = next[offset] ^ bit;
        onMusicChange(next);
    }, [music, currentPattern, editable, onMusicChange]);

    const effectiveChannel = getEffectiveChannel(music, currentPattern, selectedChannel);

    return (
        <div className="music-pattern-editor">
            {/* Channel boxes */}
            <div className="music-channels">
                {[0, 1, 2, 3].map((ch) => (
                    <div
                        key={ch}
                        className={`music-ch${pat.disabled[ch] ? ' disabled' : ''}${ch === effectiveChannel ? ' ch-selected' : ''}`}
                        onClick={() => {
                            if (!pat.disabled[ch]) onSelectChannel(ch);
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
                                    {'◀'}
                                </button>
                            )}
                            <span className={`sfx-val${pat.disabled[ch] ? ' muted' : ''}`}>
                                {pat.disabled[ch] ? '--' : pat.sfxIds[ch].toString().padStart(2, '0')}
                            </span>
                            {editable && !pat.disabled[ch] && (
                                <button onClick={(e) => { e.stopPropagation(); changeSfxId(ch, 1); }}>
                                    {'▶'}
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
                    disabled={!editable}
                >
                    {(pat.loopStart ? '● ' : '○ ') + 'Loop Start'}
                </button>
                <button
                    className={`flag-btn${pat.loopEnd ? ' loop-end-on' : ''}`}
                    onClick={() => toggleFlag(1, 0x80)}
                    disabled={!editable}
                >
                    {(pat.loopEnd ? '● ' : '○ ') + 'Loop End'}
                </button>
                <button
                    className={`flag-btn${pat.stopAtEnd ? ' stop-on' : ''}`}
                    onClick={() => toggleFlag(2, 0x80)}
                    disabled={!editable}
                >
                    {(pat.stopAtEnd ? '● ' : '○ ') + 'Stop'}
                </button>
            </div>
        </div>
    );
}
