import { useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { parseSfxNotes } from './SfxStatusBar';
import { WAVE_COLORS } from './SfxToolbar';

interface SfxListProps {
    showAudio: boolean;
    onPlaySfx: (sfxId: number) => void;
    onStopSfx: () => void;
    playingSfxId: number;
}

export function SfxList({ showAudio, onPlaySfx, onStopSfx, playingSfxId }: SfxListProps) {
    const sfx = useCartStore((s) => s.sfx);
    const sfxSelectedIndex = useUIStore((s) => s.sfxSelectedIndex);
    const setSfxSelectedIndex = useUIStore((s) => s.setSfxSelectedIndex);
    const listRef = useRef<HTMLDivElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        const container = listRef.current;
        if (!container) return;
        const activeItem = container.querySelector('.sfx-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }, [sfxSelectedIndex]);

    const renderMiniWaveform = useCallback((sfxId: number, canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        const parsed = parseSfxNotes(sfx, sfxId);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (parsed.isEmpty) return;

        const colW = w / 32;
        for (let i = 0; i < 32; i++) {
            const n = parsed.notes[i];
            if (n.volume === 0) continue;
            const barH = (n.pitch / 63) * h;
            const alpha = 0.4 + (n.volume / 7) * 0.6;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = WAVE_COLORS[n.waveform] || WAVE_COLORS[0];
            ctx.fillRect(i * colW, h - barH, Math.max(colW - 1, 1), barH);
        }
        ctx.globalAlpha = 1;
    }, [sfx]);

    return (
        <div className="sfx-list" ref={listRef}>
            {Array.from({ length: 64 }, (_, i) => {
                const parsed = parseSfxNotes(sfx, i);
                const isActive = i === sfxSelectedIndex;
                const isPlayingThis = playingSfxId === i;
                return (
                    <div
                        key={i}
                        className={`sfx-item${parsed.isEmpty ? ' empty' : ''}${isActive ? ' active' : ''}${isPlayingThis ? ' playing' : ''}`}
                        onClick={() => setSfxSelectedIndex(i)}
                    >
                        {showAudio && !parsed.isEmpty && (
                            <button
                                className={`play-btn${isPlayingThis ? ' is-playing' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPlayingThis) {
                                        onStopSfx();
                                    } else {
                                        onPlaySfx(i);
                                    }
                                }}
                            >
                                {isPlayingThis ? '\u23f9' : '\u25b6'}
                            </button>
                        )}
                        <span className="sfx-item-label">
                            {'SFX ' + i.toString().padStart(2, '0')}
                            {!parsed.isEmpty && ` spd:${parsed.speed}`}
                        </span>
                        <canvas
                            className="sfx-mini-wave"
                            width={64}
                            height={16}
                            ref={(el) => renderMiniWaveform(i, el)}
                        />
                    </div>
                );
            })}
        </div>
    );
}
