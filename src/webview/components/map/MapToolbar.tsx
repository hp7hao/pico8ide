import { useCartStore } from '../../store/cartStore';
import { useUIStore, type MapTool } from '../../store/uiStore';
import type { LocaleStrings } from '../../types';
import { useRef, useEffect } from 'react';
import { PALETTE_RGBA, getSprite } from './MapCanvas';

interface ToolDef {
    id: MapTool;
    localeKey: keyof LocaleStrings;
    key: string;
    icon: string;
}

const TOOLS: ToolDef[] = [
    { id: 'pencil', localeKey: 'toolPencil', key: 'D', icon: '\u270e' },
    { id: 'fill', localeKey: 'toolFill', key: 'F', icon: '\u25a7' },
    { id: 'select', localeKey: 'toolSelect', key: 'S', icon: '\u25a1' },
    { id: 'hand', localeKey: 'toolHand', key: 'P', icon: '\u270b' },
];

interface MapToolbarProps {
    locale: LocaleStrings;
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomFit: () => void;
    showScreenBounds: boolean;
    setShowScreenBounds: (v: boolean) => void;
    onTilePickerToggle: () => void;
    stampW: number;
    stampH: number;
    stampTiles: number[][] | null;
}

export function MapToolbar({
    locale, zoom, onZoomIn, onZoomOut, onZoomFit,
    showScreenBounds, setShowScreenBounds,
    onTilePickerToggle,
    stampW, stampH, stampTiles,
}: MapToolbarProps) {
    const tool = useUIStore((s) => s.mapTool);
    const fgTile = useUIStore((s) => s.mapSelectedTile);
    const setTool = useUIStore((s) => s.setMapTool);
    const editable = useUIStore((s) => s.editable);
    const gfx = useCartStore((s) => s.gfx);
    const previewRef = useRef<HTMLCanvasElement>(null);

    // Render tile preview
    useEffect(() => {
        const pc = previewRef.current;
        if (!pc) return;
        const ctx = pc.getContext('2d');
        if (!ctx) return;

        const pw = stampTiles ? stampW * 8 : 8;
        const ph = stampTiles ? stampH * 8 : 8;
        pc.width = pw; pc.height = ph;
        ctx.clearRect(0, 0, pw, ph);

        if (stampTiles) {
            const imgData = ctx.createImageData(pw, ph);
            for (let sy = 0; sy < stampH; sy++) {
                for (let sx = 0; sx < stampW; sx++) {
                    const sprIdx = stampTiles[sy][sx];
                    if (sprIdx === 0) continue;
                    const spritePixels = getSprite(gfx, sprIdx);
                    for (let py = 0; py < 8; py++) {
                        for (let px = 0; px < 8; px++) {
                            const color = spritePixels[py * 8 + px];
                            const ci = (color & 15) * 4;
                            const idx = ((sy * 8 + py) * pw + sx * 8 + px) * 4;
                            imgData.data[idx] = PALETTE_RGBA[ci];
                            imgData.data[idx + 1] = PALETTE_RGBA[ci + 1];
                            imgData.data[idx + 2] = PALETTE_RGBA[ci + 2];
                            imgData.data[idx + 3] = 255;
                        }
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
        } else {
            if (fgTile === 0) return;
            const spritePixels = getSprite(gfx, fgTile);
            const imgData = ctx.createImageData(8, 8);
            for (let i = 0; i < 64; i++) {
                const color = spritePixels[i];
                const ci = (color & 15) * 4;
                imgData.data[i * 4] = PALETTE_RGBA[ci];
                imgData.data[i * 4 + 1] = PALETTE_RGBA[ci + 1];
                imgData.data[i * 4 + 2] = PALETTE_RGBA[ci + 2];
                imgData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }, [gfx, fgTile, stampTiles, stampW, stampH]);

    const tileLabel = (stampTiles && (stampW > 1 || stampH > 1))
        ? `${locale.tileLabel}: #${fgTile} (${stampW}x${stampH})`
        : `${locale.tileLabel}: #${fgTile}`;

    const zoomLabel = zoom >= 1 ? Math.round(zoom) + 'x' : zoom.toFixed(1) + 'x';

    return (
        <div className="map-toolbar">
            {editable && (
                <>
                    {TOOLS.map(t => (
                        <button
                            key={t.id}
                            className={tool === t.id ? 'active' : ''}
                            title={`${locale[t.localeKey]} (${t.key})`}
                            onClick={() => setTool(t.id)}
                        >
                            {t.icon}
                        </button>
                    ))}
                    <span className="tool-sep" />

                    {/* Tile preview */}
                    <canvas
                        ref={previewRef}
                        className="tile-preview"
                        width={8}
                        height={8}
                        title={`${locale.tilePicker} (X)`}
                        onClick={onTilePickerToggle}
                        style={{
                            width: '32px',
                            height: '32px',
                            imageRendering: 'pixelated',
                            cursor: 'pointer',
                            border: '1px solid #555',
                        }}
                    />
                    <span className="tile-info">{tileLabel}</span>
                    <span className="tool-sep" />

                    {/* Screen boundary toggle */}
                    <button
                        className={showScreenBounds ? 'active' : ''}
                        title="Screen boundary (B)"
                        onClick={() => setShowScreenBounds(!showScreenBounds)}
                    >
                        {'\u25a3'}
                    </button>
                    <span className="tool-sep" />
                </>
            )}

            {/* Zoom controls */}
            <span className="zoom-group">
                <button title={locale.zoomOut} onClick={onZoomOut}>-</button>
                <span className="zoom-label">{zoomLabel}</span>
                <button title={locale.zoomIn} onClick={onZoomIn}>+</button>
                <button title={`${locale.zoomFit} (0)`} onClick={onZoomFit}>{locale.zoomFit}</button>
            </span>
        </div>
    );
}
