import { useCartStore } from '../../store/cartStore';
import { useUIStore, type SpriteTool } from '../../store/uiStore';
import { PICO8_PALETTE } from '../../types';
import type { LocaleStrings } from '../../types';

const PAL_HEX = PICO8_PALETTE.map(([r, g, b]) =>
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
);
const FLAG_COLORS = PAL_HEX.slice(8, 16);

interface ToolDef {
    id: SpriteTool;
    localeKey: keyof LocaleStrings;
    key: string;
    icon: string;
}

const TOOLS: ToolDef[] = [
    { id: 'pencil', localeKey: 'toolPencil', key: 'D', icon: '\u270e' },
    { id: 'fill', localeKey: 'toolFill', key: 'F', icon: '\u25a7' },
    { id: 'rect', localeKey: 'toolRectangle', key: 'R', icon: '\u25ad' },
    { id: 'circle', localeKey: 'toolCircle', key: 'C', icon: '\u25cb' },
    { id: 'line', localeKey: 'toolLine', key: 'L', icon: '\u2571' },
    { id: 'select', localeKey: 'toolSelect', key: 'S', icon: '\u25a1' },
    { id: 'hand', localeKey: 'toolHand', key: 'P', icon: '\u270b' },
];

interface SpriteToolbarProps {
    locale: LocaleStrings;
    flagFilter: boolean[];
    setFlagFilter: (f: boolean[]) => void;
    hoveredSprite: number;
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomFit: () => void;
}

export function SpriteToolbar({
    locale, flagFilter, setFlagFilter, hoveredSprite,
    zoom, onZoomIn, onZoomOut, onZoomFit,
}: SpriteToolbarProps) {
    const tool = useUIStore((s) => s.spriteTool);
    const fgColor = useUIStore((s) => s.spriteFgColor);
    const bgColor = useUIStore((s) => s.spriteBgColor);
    const setTool = useUIStore((s) => s.setSpriteTool);
    const setFgColor = useUIStore((s) => s.setSpriteFgColor);
    const setBgColor = useUIStore((s) => s.setSpriteBgColor);
    const editable = useUIStore((s) => s.editable);
    const flags = useCartStore((s) => s.flags);
    const setFlags = useCartStore((s) => s.setFlags);

    const flagByte = hoveredSprite >= 0 ? (flags[hoveredSprite] || 0) : 0;

    const handlePalMouseDown = (e: React.MouseEvent, ci: number) => {
        e.preventDefault();
        if (e.button === 2) {
            setBgColor(ci);
        } else {
            setFgColor(ci);
        }
    };

    const toggleFlagFilter = (idx: number) => {
        const next = [...flagFilter];
        next[idx] = !next[idx];
        setFlagFilter(next);
    };

    const toggleFlagBit = (idx: number) => {
        if (!editable || hoveredSprite < 0) return;
        const newFlags = [...flags];
        newFlags[hoveredSprite] ^= (1 << idx);
        setFlags(newFlags);
    };

    const zoomLabel = zoom >= 1 ? Math.round(zoom) + 'x' : zoom.toFixed(1) + 'x';

    return (
        <div className="sprite-toolbar">
            {/* Drawing tools (editable only) */}
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
                </>
            )}

            {/* 16 color palette swatches */}
            {Array.from({ length: 16 }, (_, ci) => (
                <span
                    key={ci}
                    className={
                        'pal-swatch' +
                        (ci === fgColor ? ' fg-active' : '') +
                        (ci === bgColor ? ' bg-active' : '')
                    }
                    style={{ background: PAL_HEX[ci] }}
                    title={ci.toString()}
                    onMouseDown={(e) => handlePalMouseDown(e, ci)}
                    onContextMenu={(e) => e.preventDefault()}
                />
            ))}
            <span className="pal-info">
                {locale.foreground}:{fgColor} {locale.background}:{bgColor}
            </span>

            <span className="tool-sep" />

            {/* Flag filter buttons */}
            <span className="flag-group">
                {Array.from({ length: 8 }, (_, fi) => (
                    <button
                        key={fi}
                        className={'flag-btn' + (flagFilter[fi] ? ' active' : '')}
                        style={{ background: FLAG_COLORS[fi] }}
                        title={locale.flagLabel + ' ' + fi}
                        onClick={() => toggleFlagFilter(fi)}
                    />
                ))}
            </span>

            {/* Flag editor circles */}
            <span className="flag-group">
                {Array.from({ length: 8 }, (_, fi) => {
                    const isSet = hoveredSprite >= 0 && (flagByte & (1 << fi));
                    return (
                        <button
                            key={fi}
                            className={'flag-dot' + (isSet ? ' set' : '')}
                            style={{
                                background: isSet ? FLAG_COLORS[fi] : 'transparent',
                                borderColor: isSet ? '#fff' : FLAG_COLORS[fi],
                            }}
                            title={locale.flagLabel + ' ' + fi}
                            onClick={() => toggleFlagBit(fi)}
                        />
                    );
                })}
            </span>

            <span className="tool-sep" />

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
