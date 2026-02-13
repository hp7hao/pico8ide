import { useRef, useEffect, useCallback, useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { getSprite, PALETTE_RGBA } from './MapCanvas';

interface TilePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (tile: number, stampTiles: number[][] | null, stampW: number, stampH: number) => void;
}

export function TilePicker({ visible, onClose, onSelect }: TilePickerProps) {
    const cvsRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gfx = useCartStore((s) => s.gfx);
    const fgTile = useUIStore((s) => s.mapSelectedTile);

    const [zoom, setZoom] = useState(4);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [hoverTile, setHoverTile] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ tx: number; ty: number } | null>(null);
    const [dragEnd, setDragEnd] = useState<{ tx: number; ty: number } | null>(null);

    const isPanningRef = useRef(false);
    const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

    const stateRef = useRef({
        zoom: 4,
        panX: 0,
        panY: 0,
    });

    const screenToTile = useCallback((clientX: number, clientY: number) => {
        const cvs = cvsRef.current;
        if (!cvs) return null;
        const rect = cvs.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        if (mx < 0 || my < 0 || mx >= rect.width || my >= rect.height) return null;
        const scaleX = 128 / rect.width;
        const scaleY = 128 / rect.height;
        return {
            tx: Math.max(0, Math.min(15, Math.floor(mx * scaleX / 8))),
            ty: Math.max(0, Math.min(15, Math.floor(my * scaleY / 8))),
        };
    }, []);

    const renderCanvas = useCallback(() => {
        const cvs = cvsRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const imgData = ctx.createImageData(128, 128);
        for (let si = 0; si < 256; si++) {
            const sprPixels = getSprite(gfx, si);
            const sx = (si % 16) * 8;
            const sy = Math.floor(si / 16) * 8;
            for (let py = 0; py < 8; py++) {
                for (let px = 0; px < 8; px++) {
                    const color = sprPixels[py * 8 + px];
                    const ci = (color & 15) * 4;
                    const idx = ((sy + py) * 128 + sx + px) * 4;
                    imgData.data[idx] = PALETTE_RGBA[ci];
                    imgData.data[idx + 1] = PALETTE_RGBA[ci + 1];
                    imgData.data[idx + 2] = PALETTE_RGBA[ci + 2];
                    imgData.data[idx + 3] = 255;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Draw overlays directly on the canvas since it's small
        // Highlight drag selection
        if (isDragging && dragStart && dragEnd) {
            const x0 = Math.min(dragStart.tx, dragEnd.tx);
            const y0 = Math.min(dragStart.ty, dragEnd.ty);
            const x1 = Math.max(dragStart.tx, dragEnd.tx);
            const y1 = Math.max(dragStart.ty, dragEnd.ty);
            ctx.strokeStyle = '#29adff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x0 * 8 + 0.5, y0 * 8 + 0.5, (x1 - x0 + 1) * 8 - 1, (y1 - y0 + 1) * 8 - 1);
        } else {
            // Highlight hovered tile
            if (hoverTile >= 0 && hoverTile < 256 && hoverTile !== fgTile) {
                const hhx = (hoverTile % 16) * 8;
                const hhy = Math.floor(hoverTile / 16) * 8;
                ctx.strokeStyle = '#ff0';
                ctx.lineWidth = 1;
                ctx.strokeRect(hhx + 0.5, hhy + 0.5, 7, 7);
            }
            // Highlight current tile
            const hx = (fgTile % 16) * 8;
            const hy = Math.floor(fgTile / 16) * 8;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(hx + 0.5, hy + 0.5, 7, 7);
        }
    }, [gfx, fgTile, hoverTile, isDragging, dragStart, dragEnd]);

    // Render on changes
    useEffect(() => {
        if (visible) renderCanvas();
    }, [visible, renderCanvas]);

    // Fit and center on open
    useEffect(() => {
        if (visible) {
            const container = containerRef.current;
            if (container) {
                const ww = container.clientWidth;
                const wh = container.clientHeight;
                const fitZoom = Math.min(ww / 128, wh / 128) * 0.9;
                const z = Math.max(1, Math.min(16, fitZoom));
                stateRef.current.zoom = z;
                stateRef.current.panX = Math.floor((ww - 128 * z) / 2);
                stateRef.current.panY = Math.floor((wh - 128 * z) / 2);
                setZoom(z);
                setPanX(stateRef.current.panX);
                setPanY(stateRef.current.panY);
            }
            setIsDragging(false);
            setDragStart(null);
            setDragEnd(null);
            renderCanvas();
        }
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.button === 1) {
            isPanningRef.current = true;
            panStartRef.current = { mx: e.clientX, my: e.clientY, px: stateRef.current.panX, py: stateRef.current.panY };
            return;
        }
        if (e.button === 0) {
            const tpos = screenToTile(e.clientX, e.clientY);
            if (tpos) {
                setDragStart({ tx: tpos.tx, ty: tpos.ty });
                setDragEnd({ tx: tpos.tx, ty: tpos.ty });
                setIsDragging(true);
            } else {
                onClose();
            }
        }
    }, [screenToTile, onClose]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanningRef.current && panStartRef.current) {
            stateRef.current.panX = panStartRef.current.px + (e.clientX - panStartRef.current.mx);
            stateRef.current.panY = panStartRef.current.py + (e.clientY - panStartRef.current.my);
            setPanX(stateRef.current.panX);
            setPanY(stateRef.current.panY);
            return;
        }
        if (isDragging && dragStart) {
            const tpos = screenToTile(e.clientX, e.clientY);
            if (tpos) {
                setDragEnd({ tx: tpos.tx, ty: tpos.ty });
            }
            return;
        }
        const tpos = screenToTile(e.clientX, e.clientY);
        setHoverTile(tpos ? tpos.ty * 16 + tpos.tx : -1);
    }, [isDragging, dragStart, screenToTile]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (isPanningRef.current) {
            isPanningRef.current = false;
            panStartRef.current = null;
            return;
        }
        if (isDragging && dragStart) {
            const endPos = dragEnd || dragStart;
            const x0 = Math.min(dragStart.tx, endPos.tx);
            const y0 = Math.min(dragStart.ty, endPos.ty);
            const x1 = Math.max(dragStart.tx, endPos.tx);
            const y1 = Math.max(dragStart.ty, endPos.ty);
            const sw = x1 - x0 + 1;
            const sh = y1 - y0 + 1;
            const newTile = y0 * 16 + x0;
            if (sw === 1 && sh === 1) {
                onSelect(newTile, null, 1, 1);
            } else {
                const tiles: number[][] = [];
                for (let ty = 0; ty < sh; ty++) {
                    const row: number[] = [];
                    for (let tx = 0; tx < sw; tx++) {
                        row.push((y0 + ty) * 16 + (x0 + tx));
                    }
                    tiles.push(row);
                }
                onSelect(newTile, tiles, sw, sh);
            }
            setIsDragging(false);
            setDragStart(null);
            setDragEnd(null);
            onClose();
        }
    }, [isDragging, dragStart, dragEnd, onSelect, onClose]);

    if (!visible) return null;

    const cvsSize = 128 * stateRef.current.zoom;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={(e) => {
                if (e.target === containerRef.current) onClose();
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: Math.min(cvsSize + 16, 600) + 'px',
                    height: Math.min(cvsSize + 16, 600) + 'px',
                    background: '#222',
                    border: '2px solid #555',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    padding: '8px',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                <canvas
                    ref={cvsRef}
                    width={128}
                    height={128}
                    style={{
                        width: cvsSize + 'px',
                        height: cvsSize + 'px',
                        imageRendering: 'pixelated',
                        position: 'absolute',
                        left: stateRef.current.panX + 'px',
                        top: stateRef.current.panY + 'px',
                    }}
                />
            </div>
        </div>
    );
}
