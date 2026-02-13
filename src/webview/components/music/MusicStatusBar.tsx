interface MusicStatusBarProps {
    patternIndex: number;
    playingPattern: number;
    isPlaying: boolean;
    playingPatternLabel: string;
}

export function MusicStatusBar({ patternIndex, playingPattern, isPlaying, playingPatternLabel }: MusicStatusBarProps) {
    let text = `Pattern ${patternIndex.toString().padStart(2, '0')}`;
    if (isPlaying) {
        text = `${playingPatternLabel} ${playingPattern}`;
    }
    return (
        <div className="music-statusbar">{text}</div>
    );
}
