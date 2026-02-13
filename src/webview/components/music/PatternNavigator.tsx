interface PatternData {
    sfxIds: number[];
    disabled: boolean[];
    loopStart: boolean;
    loopEnd: boolean;
    stopAtEnd: boolean;
    isEmpty: boolean;
}

export function parsePattern(music: number[], idx: number): PatternData {
    const offset = idx * 4;
    const ch0 = music[offset] || 0;
    const ch1 = music[offset + 1] || 0;
    const ch2 = music[offset + 2] || 0;
    const ch3 = music[offset + 3] || 0;
    const channels = [ch0, ch1, ch2, ch3];
    return {
        sfxIds: channels.map((c) => c & 0x3f),
        disabled: channels.map((c) => (c & 0x40) !== 0),
        loopStart: (ch0 & 0x80) !== 0,
        loopEnd: (ch1 & 0x80) !== 0,
        stopAtEnd: (ch2 & 0x80) !== 0,
        isEmpty: channels.every((c) => (c & 0x40) !== 0),
    };
}

interface PatternNavigatorProps {
    music: number[];
    currentPattern: number;
    playingPattern: number;
    isPlaying: boolean;
    onSelectPattern: (idx: number) => void;
}

export function PatternNavigator({ music, currentPattern, playingPattern, isPlaying, onSelectPattern }: PatternNavigatorProps) {
    return (
        <div className="music-navigator">
            <div className="music-nav-grid">
                {Array.from({ length: 64 }, (_, i) => {
                    const pat = parsePattern(music, i);
                    let cls = 'music-nav-cell';
                    if (i === currentPattern) cls += ' selected';
                    if (pat.isEmpty) cls += ' empty';
                    else cls += ' non-empty';
                    if (pat.loopStart) cls += ' loop-start';
                    if (pat.loopEnd) cls += ' loop-end';
                    if (pat.stopAtEnd) cls += ' stop-end';
                    if (isPlaying && i === playingPattern) cls += ' playing';
                    return (
                        <div
                            key={i}
                            className={cls}
                            onClick={() => onSelectPattern(i)}
                        >
                            {i.toString().padStart(2, '0')}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
