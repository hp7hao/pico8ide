import { useState, useRef, useCallback } from 'react';
import { SpriteCanvas } from './SpriteCanvas';
import { SpriteToolbar } from './SpriteToolbar';
import { SpriteStatusBar } from './SpriteStatusBar';
import { PICO8_PALETTE } from '../../types';
import { useUIStore } from '../../store/uiStore';
import type { LocaleStrings } from '../../types';

const PAL_HEX = PICO8_PALETTE.map(([r, g, b]) =>
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
);

interface SpriteTabProps {
    locale: LocaleStrings;
}

export function SpriteTab({ locale }: SpriteTabProps) {
    const [mouseX, setMouseX] = useState(-1);
    const [mouseY, setMouseY] = useState(-1);
    const [flagFilter, setFlagFilter] = useState<boolean[]>([false, false, false, false, false, false, false, false]);
    const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number; data?: number[] | null } | null>(null);
    const [clipboard, setClipboard] = useState<{ w: number; h: number; data: number[] } | null>(null);
    const [hoveredSprite, setHoveredSprite] = useState(-1);
    const [quickPaletteVisible, setQuickPaletteVisible] = useState(false);
    const [quickPalettePos, setQuickPalettePos] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(4);

    const undoStackRef = useRef<number[][]>([]);
    const redoStackRef = useRef<number[][]>([]);

    // Zoom control callbacks (will be wired through canvas ref)
    const canvasActionsRef = useRef<{
        zoomIn: () => void;
        zoomOut: () => void;
        zoomFit: () => void;
        getZoom: () => number;
    } | null>(null);

    const onZoomIn = useCallback(() => canvasActionsRef.current?.zoomIn(), []);
    const onZoomOut = useCallback(() => canvasActionsRef.current?.zoomOut(), []);
    const onZoomFit = useCallback(() => canvasActionsRef.current?.zoomFit(), []);

    const handleQuickPaletteSelect = (ci: number, button: number) => {
        if (button === 2) {
            useUIStore.getState().setSpriteBgColor(ci);
        } else {
            useUIStore.getState().setSpriteFgColor(ci);
        }
        setQuickPaletteVisible(false);
    };

    return (
        <div className="sprite-editor">
            <SpriteToolbar
                locale={locale}
                flagFilter={flagFilter}
                setFlagFilter={setFlagFilter}
                hoveredSprite={hoveredSprite}
                zoom={zoom}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onZoomFit={onZoomFit}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                <SpriteCanvas
                    mouseX={mouseX}
                    mouseY={mouseY}
                    setMouseX={setMouseX}
                    setMouseY={setMouseY}
                    flagFilter={flagFilter}
                    selection={selection}
                    setSelection={setSelection}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    undoStackRef={undoStackRef}
                    redoStackRef={redoStackRef}
                    quickPaletteVisible={quickPaletteVisible}
                    setQuickPaletteVisible={setQuickPaletteVisible}
                    quickPalettePos={quickPalettePos}
                    setQuickPalettePos={setQuickPalettePos}
                    onHoveredSpriteChange={setHoveredSprite}
                />
                {/* Quick palette popup */}
                {quickPaletteVisible && (
                    <div
                        className="quick-palette"
                        style={{
                            position: 'absolute',
                            left: quickPalettePos.x + 'px',
                            top: quickPalettePos.y + 'px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '2px',
                            padding: '4px',
                            background: '#222',
                            border: '1px solid #555',
                            borderRadius: '4px',
                            zIndex: 100,
                        }}
                    >
                        {Array.from({ length: 16 }, (_, ci) => (
                            <span
                                key={ci}
                                className="qp-swatch"
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    background: PAL_HEX[ci],
                                    cursor: 'pointer',
                                    display: 'inline-block',
                                    border: '1px solid #666',
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleQuickPaletteSelect(ci, e.button);
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                            />
                        ))}
                    </div>
                )}
            </div>
            <SpriteStatusBar locale={locale} mouseX={mouseX} mouseY={mouseY} />
        </div>
    );
}
