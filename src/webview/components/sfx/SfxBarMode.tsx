import { useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { parseSfxNotes, sfxSetNoteField, SfxNote } from './SfxStatusBar';
import { WAVE_COLORS, FX_COLORS } from './SfxToolbar';

interface SfxBarModeProps {
    hoverNote: number;
    onHoverNoteChange: (note: number) => void;
    onHoverAreaChange: (area: string) => void;
    onPushUndo: () => void;
}

export function SfxBarMode({ hoverNote, onHoverNoteChange, onHoverAreaChange, onPushUndo }: SfxBarModeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const sfx = useCartStore((s) => s.sfx);
    const setSfx = useCartStore((s) => s.setSfx);
    const sfxId = useUIStore((s) => s.sfxSelectedIndex);
    const brushWave = useUIStore((s) => s.sfxSelectedWaveform);
    const brushEffect = useUIStore((s) => s.sfxSelectedEffect);
    const editable = useUIStore((s) => s.editable);

    const isDrawingRef = useRef(false);
    const drawAreaRef = useRef('');
    const sfxRef = useRef(sfx);
    sfxRef.current = sfx;

    const render = useCallback(() => {
        const cvs = canvasRef.current;
        const wrap = wrapRef.current;
        if (!cvs || !wrap) return;

        const w = wrap.clientWidth || 640;
        const h = wrap.clientHeight || 320;
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        const parsed = parseSfxNotes(sfxRef.current, sfxId);
        const colW = Math.floor(w / 32);
        const fxH = 16;
        const volH = Math.floor((h - fxH) * 0.15);
        const pitchH = h - volH - fxH;
        const pitchY = 0;
        const volY = pitchH;
        const fxY = pitchH + volH;

        // Loop region shade
        if (parsed.loopStart < parsed.loopEnd) {
            ctx.fillStyle = 'rgba(100,200,100,0.07)';
            ctx.fillRect(parsed.loopStart * colW, 0, (parsed.loopEnd - parsed.loopStart) * colW, h);
            ctx.strokeStyle = 'rgba(100,200,100,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(parsed.loopStart * colW + 0.5, 0);
            ctx.lineTo(parsed.loopStart * colW + 0.5, h);
            ctx.moveTo(parsed.loopEnd * colW + 0.5, 0);
            ctx.lineTo(parsed.loopEnd * colW + 0.5, h);
            ctx.stroke();
        }

        // Octave grid lines
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        for (let oct = 1; oct <= 5; oct++) {
            const y = pitchY + pitchH - (oct * 12 / 63) * pitchH;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Area separators
        ctx.strokeStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(0, volY);
        ctx.lineTo(w, volY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, fxY);
        ctx.lineTo(w, fxY);
        ctx.stroke();

        // Draw bars
        for (let i = 0; i < 32; i++) {
            const n = parsed.notes[i];
            const x = i * colW;

            // Pitch bar
            if (n.volume > 0 && n.pitch > 0) {
                const barH = (n.pitch / 63) * pitchH;
                ctx.globalAlpha = 0.4 + (n.volume / 7) * 0.6;
                ctx.fillStyle = WAVE_COLORS[n.waveform] || WAVE_COLORS[0];
                ctx.fillRect(x + 1, pitchY + pitchH - barH, colW - 2, barH);
                ctx.globalAlpha = 1;
            } else if (n.pitch > 0) {
                const barH = (n.pitch / 63) * pitchH;
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = WAVE_COLORS[n.waveform] || WAVE_COLORS[0];
                ctx.fillRect(x + 1, pitchY + pitchH - barH, colW - 2, barH);
                ctx.globalAlpha = 1;
            }

            // Volume mini-bar
            if (n.volume > 0) {
                const vBarH = (n.volume / 7) * (volH - 2);
                ctx.fillStyle = '#00e436';
                ctx.fillRect(x + 1, volY + volH - vBarH - 1, colW - 2, vBarH);
            }

            // Effect cell
            if (n.effect > 0) {
                ctx.fillStyle = FX_COLORS[n.effect] || FX_COLORS[0];
                ctx.fillRect(x + 1, fxY + 1, colW - 2, fxH - 2);
            }

            // Column separator
            ctx.strokeStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
            ctx.stroke();
        }

        // Hover highlight
        if (hoverNote >= 0 && hoverNote < 32) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(hoverNote * colW + 0.5, 0.5, colW - 1, h - 1);
        }
    }, [sfxId, hoverNote]);

    // Render on relevant changes
    useEffect(() => {
        render();
    }, [render, sfx]);

    // Resize observer
    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap || !window.ResizeObserver) return;
        const ro = new ResizeObserver(() => render());
        ro.observe(wrap);
        return () => ro.disconnect();
    }, [render]);

    const hitTest = useCallback((e: React.MouseEvent | MouseEvent) => {
        const cvs = canvasRef.current;
        if (!cvs) return { noteIdx: 0, area: '', value: 0 };
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;
        const colW = w / 32;
        const pitchH = h * 0.70;
        const volH = h * 0.15;
        let noteIdx = Math.floor(mx / colW);
        noteIdx = Math.max(0, Math.min(31, noteIdx));
        let area = '';
        let value = 0;
        if (my < pitchH) {
            area = 'pitch';
            value = Math.round((1 - my / pitchH) * 63);
            value = Math.max(0, Math.min(63, value));
        } else if (my < pitchH + volH) {
            area = 'volume';
            value = Math.round((1 - ((my - pitchH) / volH)) * 7);
            value = Math.max(0, Math.min(7, value));
        } else {
            area = 'effect';
            value = brushEffect;
        }
        return { noteIdx, area, value };
    }, [brushEffect]);

    const applyDraw = useCallback((noteIdx: number, area: string, value: number) => {
        if (!editable) return;
        let next = sfxRef.current;
        if (area === 'pitch') {
            next = sfxSetNoteField(next, sfxId, noteIdx, 'pitch', value);
            next = sfxSetNoteField(next, sfxId, noteIdx, 'waveform', brushWave);
            // Ensure volume > 0
            const lo = next[sfxId * 68 + noteIdx * 2] || 0;
            const hi = next[sfxId * 68 + noteIdx * 2 + 1] || 0;
            const vol = (hi >> 1) & 0x07;
            if (vol === 0) {
                next = sfxSetNoteField(next, sfxId, noteIdx, 'volume', 5);
            }
        } else if (area === 'volume') {
            next = sfxSetNoteField(next, sfxId, noteIdx, 'volume', value);
        } else if (area === 'effect') {
            next = sfxSetNoteField(next, sfxId, noteIdx, 'effect', value);
        }
        setSfx(next);
        sfxRef.current = next;
    }, [editable, sfxId, brushWave, setSfx]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const hit = hitTest(e);
        if (e.button === 2) {
            // Right-click: eyedropper
            const parsed = parseSfxNotes(sfxRef.current, sfxId);
            const n = parsed.notes[hit.noteIdx];
            if (hit.area === 'pitch') {
                useUIStore.getState().setSfxSelectedWaveform(n.waveform);
            } else if (hit.area === 'effect') {
                useUIStore.getState().setSfxSelectedEffect(n.effect);
            }
            return;
        }
        if (e.button === 0 && editable) {
            onPushUndo();
            isDrawingRef.current = true;
            drawAreaRef.current = hit.area;
            applyDraw(hit.noteIdx, hit.area, hit.value);
        }
    }, [hitTest, sfxId, editable, applyDraw, onPushUndo]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const hit = hitTest(e);
        onHoverNoteChange(hit.noteIdx);
        onHoverAreaChange(hit.area);
        if (isDrawingRef.current && editable) {
            applyDraw(hit.noteIdx, drawAreaRef.current, hit.value);
        }
    }, [hitTest, editable, applyDraw, onHoverNoteChange, onHoverAreaChange]);

    const handleMouseUp = useCallback(() => {
        if (isDrawingRef.current) {
            isDrawingRef.current = false;
            drawAreaRef.current = '';
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        onHoverNoteChange(-1);
        onHoverAreaChange('');
        if (isDrawingRef.current) {
            isDrawingRef.current = false;
            drawAreaRef.current = '';
        }
    }, [onHoverNoteChange, onHoverAreaChange]);

    // Global mouseup handler
    useEffect(() => {
        const up = () => {
            if (isDrawingRef.current) {
                isDrawingRef.current = false;
                drawAreaRef.current = '';
            }
        };
        window.addEventListener('mouseup', up);
        return () => window.removeEventListener('mouseup', up);
    }, []);

    return (
        <div className="sfx-canvas-wrap" ref={wrapRef}>
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />
        </div>
    );
}
