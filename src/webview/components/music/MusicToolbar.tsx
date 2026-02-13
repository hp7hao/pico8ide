import type { LocaleStrings } from '../../types';

interface MusicToolbarProps {
    locale: LocaleStrings;
    patternIndex: number;
    onPrev: () => void;
    onNext: () => void;
    showAudio: boolean;
    isPlaying: boolean;
    onTogglePlay: () => void;
    editable: boolean;
    onClear: () => void;
}

export function MusicToolbar({
    locale,
    patternIndex,
    onPrev,
    onNext,
    showAudio,
    isPlaying,
    onTogglePlay,
    editable,
    onClear,
}: MusicToolbarProps) {
    return (
        <div className="music-toolbar">
            <span className="sfx-label">PATTERN</span>
            <button onClick={onPrev}>{'\u25c0'}</button>
            <span className="sfx-val">{patternIndex.toString().padStart(2, '0')}</span>
            <button onClick={onNext}>{'\u25b6'}</button>

            {showAudio && (
                <>
                    <span className="tool-sep" />
                    <button onClick={onTogglePlay}>
                        {isPlaying ? '\u23f9 ' + locale.stop : '\u25b6 ' + locale.play}
                    </button>
                </>
            )}

            {editable && (
                <>
                    <span className="tool-sep" />
                    <button
                        title="Clear current pattern"
                        onClick={onClear}
                        style={{ color: '#ff004d' }}
                    >
                        CLR
                    </button>
                </>
            )}
        </div>
    );
}
