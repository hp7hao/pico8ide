import { useCallback } from 'react';

interface SfxPickerProps {
    music: number[];
    sfxData: number[];
    currentPattern: number;
    effectiveChannel: number;
    currentSfxId: number;
    editable: boolean;
    showAudio: boolean;
    onMusicChange: (music: number[]) => void;
    onPlaySfx: (sfxId: number) => void;
    onStopSfx: () => void;
    playingSfxId: number;
}

export function SfxPicker({
    music,
    sfxData,
    currentPattern,
    effectiveChannel,
    currentSfxId,
    editable,
    showAudio,
    onMusicChange,
    onPlaySfx,
    onStopSfx,
    playingSfxId,
}: SfxPickerProps) {
    const selectSfxForChannel = useCallback((ch: number, sfxIdx: number) => {
        if (!editable || ch < 0 || ch > 3) return;
        const next = [...music];
        const offset = currentPattern * 4 + ch;
        const flags = next[offset] & 0xc0;
        next[offset] = flags | (sfxIdx & 0x3f);
        onMusicChange(next);
    }, [music, currentPattern, editable, onMusicChange]);

    return (
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
    );
}
