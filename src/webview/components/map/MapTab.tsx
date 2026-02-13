import { useState, useRef, useCallback } from 'react';
import { MapCanvas } from './MapCanvas';
import { MapToolbar } from './MapToolbar';
import { TilePicker } from './TilePicker';
import { useUIStore } from '../../store/uiStore';
import type { LocaleStrings } from '../../types';

interface MapTabProps {
    locale: LocaleStrings;
}

export function MapTab({ locale }: MapTabProps) {
    const [mouseTX, setMouseTX] = useState(-1);
    const [mouseTY, setMouseTY] = useState(-1);
    const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number; data?: number[] | null } | null>(null);
    const [clipboard, setClipboard] = useState<{ w: number; h: number; data: number[] } | null>(null);
    const [tilePickerVisible, setTilePickerVisible] = useState(false);
    const [showScreenBounds, setShowScreenBounds] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [stampTiles, setStampTiles] = useState<number[][] | null>(null);
    const [stampW, setStampW] = useState(1);
    const [stampH, setStampH] = useState(1);

    const undoStackRef = useRef<{ map: number[]; gfx: number[] }[]>([]);
    const redoStackRef = useRef<{ map: number[]; gfx: number[] }[]>([]);

    const canvasActionsRef = useRef<{
        zoomIn: () => void;
        zoomOut: () => void;
        zoomFit: () => void;
    } | null>(null);

    const onZoomIn = useCallback(() => canvasActionsRef.current?.zoomIn(), []);
    const onZoomOut = useCallback(() => canvasActionsRef.current?.zoomOut(), []);
    const onZoomFit = useCallback(() => canvasActionsRef.current?.zoomFit(), []);

    const handleTilePickerSelect = useCallback((tile: number, tiles: number[][] | null, sw: number, sh: number) => {
        useUIStore.getState().setMapSelectedTile(tile);
        setStampTiles(tiles);
        setStampW(sw);
        setStampH(sh);
    }, []);

    const tileLabel = mouseTX >= 0 && mouseTX < 128 && mouseTY >= 0 && mouseTY < 64
        ? `${locale.position}: (${mouseTX}, ${mouseTY})`
        : '';

    return (
        <div className="map-editor">
            <MapToolbar
                locale={locale}
                zoom={zoom}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onZoomFit={onZoomFit}
                showScreenBounds={showScreenBounds}
                setShowScreenBounds={setShowScreenBounds}
                onTilePickerToggle={() => setTilePickerVisible(!tilePickerVisible)}
                stampW={stampW}
                stampH={stampH}
                stampTiles={stampTiles}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                <MapCanvas
                    mouseTX={mouseTX}
                    mouseTY={mouseTY}
                    setMouseTX={setMouseTX}
                    setMouseTY={setMouseTY}
                    selection={selection}
                    setSelection={setSelection}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    undoStackRef={undoStackRef}
                    redoStackRef={redoStackRef}
                    tilePickerVisible={tilePickerVisible}
                    setTilePickerVisible={setTilePickerVisible}
                    showScreenBounds={showScreenBounds}
                    stampTiles={stampTiles}
                    stampW={stampW}
                    stampH={stampH}
                    setStampTiles={setStampTiles}
                    setStampW={setStampW}
                    setStampH={setStampH}
                    onZoomChange={setZoom}
                />
                <TilePicker
                    visible={tilePickerVisible}
                    onClose={() => setTilePickerVisible(false)}
                    onSelect={handleTilePickerSelect}
                />
            </div>
            <div className="map-statusbar">{tileLabel}</div>
        </div>
    );
}
