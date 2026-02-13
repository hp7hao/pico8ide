import { useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore, type MapTool } from '../../store/uiStore';
import { PICO8_PALETTE } from '../../types';

// Pre-compute RGBA palette
const PALETTE_RGBA = new Uint8Array(16 * 4);
for (let i = 0; i < 16; i++) {
    PALETTE_RGBA[i * 4] = PICO8_PALETTE[i][0];
    PALETTE_RGBA[i * 4 + 1] = PICO8_PALETTE[i][1];
    PALETTE_RGBA[i * 4 + 2] = PICO8_PALETTE[i][2];
    PALETTE_RGBA[i * 4 + 3] = 255;
}

// ---- Tile get/set ----

function meGetTile(map: number[], gfx: number[], tx: number, ty: number): number {
    if (tx < 0 || tx >= 128 || ty < 0 || ty >= 64) return 0;
    if (ty < 32) {
        return map[ty * 128 + tx] || 0;
    } else {
        return gfx[4096 + (ty - 32) * 128 + tx] || 0;
    }
}

function meSetTile(map: number[], gfx: number[], tx: number, ty: number, sprIdx: number): void {
    if (tx < 0 || tx >= 128 || ty < 0 || ty >= 64) return;
    if (ty < 32) {
        map[ty * 128 + tx] = sprIdx;
    } else {
        gfx[4096 + (ty - 32) * 128 + tx] = sprIdx;
    }
}

// ---- getSprite helper ----

function getSprite(gfx: number[], spriteIdx: number): number[] {
    const sx = (spriteIdx % 16) * 8;
    const sy = Math.floor(spriteIdx / 16) * 8;
    const pixels: number[] = [];
    for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
            const x = sx + px, y = sy + py;
            const byteIdx = y * 64 + Math.floor(x / 2);
            const b = gfx[byteIdx] || 0;
            pixels.push((x % 2 === 0) ? (b & 0x0f) : ((b >> 4) & 0x0f));
        }
    }
    return pixels;
}

// ---- Flood fill ----

function meFloodFill(map: number[], gfx: number[], tx: number, ty: number, newTile: number): void {
    const targetTile = meGetTile(map, gfx, tx, ty);
    if (targetTile === newTile) return;
    const stack: number[][] = [[tx, ty]];
    const visited: Record<string, boolean> = {};
    while (stack.length > 0) {
        const p = stack.pop()!;
        const cx = p[0], cy = p[1];
        if (cx < 0 || cx >= 128 || cy < 0 || cy >= 64) continue;
        const key = cx + ',' + cy;
        if (visited[key]) continue;
        if (meGetTile(map, gfx, cx, cy) !== targetTile) continue;
        visited[key] = true;
        meSetTile(map, gfx, cx, cy, newTile);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
}

// ---- Bresenham line for tile coordinates ----

function meBresenhamLine(map: number[], gfx: number[], x0: number, y0: number, x1: number, y1: number, tile: number): void {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
        meSetTile(map, gfx, x0, y0, tile);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

// ---- Rectangle fill ----

function meRectFill(map: number[], gfx: number[], x0: number, y0: number, x1: number, y1: number, tile: number): void {
    const rx = Math.max(0, Math.min(x0, x1));
    const ry = Math.max(0, Math.min(y0, y1));
    const rx2 = Math.min(127, Math.max(x0, x1));
    const ry2 = Math.min(63, Math.max(y0, y1));
    for (let yy = ry; yy <= ry2; yy++)
        for (let xx = rx; xx <= rx2; xx++)
            meSetTile(map, gfx, xx, yy, tile);
}

// ---- Selection helpers ----

interface MapSelection {
    x: number; y: number; w: number; h: number;
    data?: number[] | null;
}

function meGetSelectionTiles(map: number[], gfx: number[], sel: MapSelection): number[] {
    const data: number[] = [];
    for (let y = 0; y < sel.h; y++)
        for (let x = 0; x < sel.w; x++)
            data.push(meGetTile(map, gfx, sel.x + x, sel.y + y));
    return data;
}

function mePasteTiles(map: number[], gfx: number[], px: number, py: number, w: number, h: number, data: number[]): void {
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            meSetTile(map, gfx, px + x, py + y, data[y * w + x]);
}

function meClearTileRect(map: number[], gfx: number[], x: number, y: number, w: number, h: number): void {
    for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++)
            meSetTile(map, gfx, x + xx, y + yy, 0);
}

// ---- Constants ----
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 16;
const ZOOM_FACTOR = 1.08;

interface MapCanvasProps {
    mouseTX: number;
    mouseTY: number;
    setMouseTX: (x: number) => void;
    setMouseTY: (y: number) => void;
    selection: MapSelection | null;
    setSelection: (sel: MapSelection | null) => void;
    clipboard: { w: number; h: number; data: number[] } | null;
    setClipboard: (clip: { w: number; h: number; data: number[] } | null) => void;
    undoStackRef: React.MutableRefObject<{ map: number[]; gfx: number[] }[]>;
    redoStackRef: React.MutableRefObject<{ map: number[]; gfx: number[] }[]>;
    tilePickerVisible: boolean;
    setTilePickerVisible: (v: boolean) => void;
    showScreenBounds: boolean;
    stampTiles: number[][] | null;
    stampW: number;
    stampH: number;
    setStampTiles: (t: number[][] | null) => void;
    setStampW: (w: number) => void;
    setStampH: (h: number) => void;
    onZoomChange: (zoom: number) => void;
}

export function MapCanvas({
    mouseTX, mouseTY, setMouseTX, setMouseTY,
    selection, setSelection,
    clipboard, setClipboard,
    undoStackRef, redoStackRef,
    tilePickerVisible, setTilePickerVisible,
    showScreenBounds,
    stampTiles, stampW, stampH,
    setStampTiles, setStampW, setStampH,
    onZoomChange,
}: MapCanvasProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const cvsRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    const stateRef = useRef({
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: null as { mx: number; my: number; px: number; py: number } | null,
        isDrawing: false,
        drawStart: null as { tx: number; ty: number } | null,
        spaceHeld: false,
        prevTool: null as MapTool | null,
        selDragging: false,
        selDragStart: null as { mx: number; my: number; sx: number; sy: number } | null,
        marchingAntsOffset: 0,
        fitted: false,
        forceFullRedraw: true,
        lastImgData: null as ImageData | null,
    });

    const map = useCartStore((s) => s.map);
    const gfx = useCartStore((s) => s.gfx);
    const flags = useCartStore((s) => s.flags);
    const setMap = useCartStore((s) => s.setMap);
    const tool = useUIStore((s) => s.mapTool);
    const fgTile = useUIStore((s) => s.mapSelectedTile);
    const setTool = useUIStore((s) => s.setMapTool);
    const setFgTile = useUIStore((s) => s.setMapSelectedTile);
    const editable = useUIStore((s) => s.editable);
    const activeTab = useUIStore((s) => s.activeTab);

    const toolRef = useRef(tool);
    toolRef.current = tool;
    const fgTileRef = useRef(fgTile);
    fgTileRef.current = fgTile;
    const editableRef = useRef(editable);
    editableRef.current = editable;
    const mapRef = useRef(map);
    mapRef.current = map;
    const gfxRef = useRef(gfx);
    gfxRef.current = gfx;
    const selectionRef = useRef(selection);
    selectionRef.current = selection;
    const clipboardRef = useRef(clipboard);
    clipboardRef.current = clipboard;
    const mouseTXRef = useRef(mouseTX);
    mouseTXRef.current = mouseTX;
    const mouseTYRef = useRef(mouseTY);
    mouseTYRef.current = mouseTY;
    const stampTilesRef = useRef(stampTiles);
    stampTilesRef.current = stampTiles;
    const stampWRef = useRef(stampW);
    stampWRef.current = stampW;
    const stampHRef = useRef(stampH);
    stampHRef.current = stampH;
    const showScreenBoundsRef = useRef(showScreenBounds);
    showScreenBoundsRef.current = showScreenBounds;
    const tilePickerVisibleRef = useRef(tilePickerVisible);
    tilePickerVisibleRef.current = tilePickerVisible;

    // ---- Coordinate conversion ----
    const screenToTile = useCallback((clientX: number, clientY: number) => {
        const wrap = wrapRef.current;
        if (!wrap) return { tx: -1, ty: -1, mx: 0, my: 0 };
        const rect = wrap.getBoundingClientRect();
        const st = stateRef.current;
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        const px = (mx - st.panX) / st.zoom;
        const py = (my - st.panY) / st.zoom;
        const tx = Math.floor(px / 8);
        const ty = Math.floor(py / 8);
        return { tx, ty, mx, my };
    }, []);

    // ---- Tile rendering helper ----
    const renderTile = useCallback((imgData: ImageData, currentGfx: number[], tx: number, ty: number, currentMap: number[]) => {
        const spriteIdx = meGetTile(currentMap, currentGfx, tx, ty);
        const baseX = tx * 8, baseY = ty * 8;
        if (spriteIdx === 0) {
            for (let py = 0; py < 8; py++) {
                const rowOff = ((baseY + py) * 1024 + baseX) * 4;
                for (let px = 0; px < 8; px++) {
                    const idx = rowOff + px * 4;
                    imgData.data[idx] = 0; imgData.data[idx + 1] = 0; imgData.data[idx + 2] = 0; imgData.data[idx + 3] = 0;
                }
            }
            return;
        }
        const spritePixels = getSprite(currentGfx, spriteIdx);
        for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
                const color = spritePixels[py * 8 + px];
                const ci = (color & 15) * 4;
                const idx = ((baseY + py) * 1024 + baseX + px) * 4;
                imgData.data[idx] = PALETTE_RGBA[ci];
                imgData.data[idx + 1] = PALETTE_RGBA[ci + 1];
                imgData.data[idx + 2] = PALETTE_RGBA[ci + 2];
                imgData.data[idx + 3] = 255;
            }
        }
    }, []);

    // ---- Canvas rendering ----
    const renderCanvas = useCallback(() => {
        const cvs = cvsRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        const st = stateRef.current;
        const currentMap = mapRef.current;
        const currentGfx = gfxRef.current;

        // Always do full redraw for simplicity in React
        const imgData = ctx.createImageData(1024, 512);
        for (let ty = 0; ty < 64; ty++) {
            for (let tx = 0; tx < 128; tx++) {
                renderTile(imgData, currentGfx, tx, ty, currentMap);
            }
        }
        ctx.putImageData(imgData, 0, 0);
        st.lastImgData = imgData;
        st.forceFullRedraw = false;

        updateCanvasTransform();
        renderOverlay();
    }, [renderTile]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateCanvasTransform = useCallback(() => {
        const cvs = cvsRef.current;
        const overlay = overlayRef.current;
        if (!cvs || !overlay) return;
        const st = stateRef.current;
        const sw = 1024 * st.zoom;
        const sh = 512 * st.zoom;
        cvs.style.width = sw + 'px'; cvs.style.height = sh + 'px';
        cvs.style.left = st.panX + 'px'; cvs.style.top = st.panY + 'px';
        overlay.width = sw; overlay.height = sh;
        overlay.style.width = sw + 'px'; overlay.style.height = sh + 'px';
        overlay.style.left = st.panX + 'px'; overlay.style.top = st.panY + 'px';
    }, []);

    const renderShapePreview = useCallback((ctx: CanvasRenderingContext2D) => {
        const st = stateRef.current;
        if (!st.drawStart) return;
        const x0 = st.drawStart.tx, y0 = st.drawStart.ty;
        const x1 = mouseTXRef.current, y1 = mouseTYRef.current;
        const currentTool = toolRef.current;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, st.zoom);
        if (currentTool === 'pencil') {
            // line preview for pencil used as line tool
            ctx.beginPath();
            ctx.moveTo(x0 * 8 * st.zoom + 4 * st.zoom, y0 * 8 * st.zoom + 4 * st.zoom);
            ctx.lineTo(x1 * 8 * st.zoom + 4 * st.zoom, y1 * 8 * st.zoom + 4 * st.zoom);
            ctx.stroke();
        }
        ctx.restore();
    }, []);

    const renderOverlay = useCallback(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        const st = stateRef.current;
        const sel = selectionRef.current;
        const mTX = mouseTXRef.current, mTY = mouseTYRef.current;
        const sw = 1024 * st.zoom;
        const sh = 512 * st.zoom;
        ctx.clearRect(0, 0, sw, sh);

        // Tile grid at zoom >= 1
        if (st.zoom >= 1) {
            ctx.strokeStyle = 'rgba(68,68,68,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let gx = 0; gx <= 1024; gx += 8) {
                ctx.moveTo(gx * st.zoom + 0.5, 0);
                ctx.lineTo(gx * st.zoom + 0.5, sh);
            }
            for (let gy = 0; gy <= 512; gy += 8) {
                ctx.moveTo(0, gy * st.zoom + 0.5);
                ctx.lineTo(sw, gy * st.zoom + 0.5);
            }
            ctx.stroke();
        }

        // Row 32 visual divider
        const row32y = 32 * 8 * st.zoom;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 77, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, row32y);
        ctx.lineTo(sw, row32y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (st.zoom >= 0.5) {
            ctx.fillStyle = 'rgba(255, 0, 77, 0.5)';
            ctx.font = Math.max(9, Math.min(12, 10 * st.zoom)) + 'px monospace';
            ctx.fillText('shared with sprites', 4, row32y + Math.max(10, 12 * st.zoom));
        }
        ctx.restore();

        // Screen boundary overlay
        if (showScreenBoundsRef.current) {
            ctx.save();
            ctx.strokeStyle = 'rgba(41, 173, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(0.5, 0.5, 128 * st.zoom, 128 * st.zoom);
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Hover tile highlight
        if (mTX >= 0 && mTX < 128 && mTY >= 0 && mTY < 64) {
            const hoverW = (toolRef.current === 'pencil' && stampTilesRef.current) ? stampWRef.current : 1;
            const hoverH = (toolRef.current === 'pencil' && stampTilesRef.current) ? stampHRef.current : 1;
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                mTX * 8 * st.zoom + 0.5,
                mTY * 8 * st.zoom + 0.5,
                8 * hoverW * st.zoom - 1,
                8 * hoverH * st.zoom - 1
            );
        }

        // Selection marching ants
        if (sel && !st.selDragging) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = st.marchingAntsOffset;
            ctx.strokeRect(
                sel.x * 8 * st.zoom + 0.5,
                sel.y * 8 * st.zoom + 0.5,
                sel.w * 8 * st.zoom,
                sel.h * 8 * st.zoom
            );
            ctx.setLineDash([]);
        }
    }, [renderShapePreview]);

    // ---- Pan/Zoom helpers ----
    const clampPan = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const st = stateRef.current;
        const cw = 1024 * st.zoom;
        const ch = 512 * st.zoom;
        const ww = wrap.clientWidth;
        const wh = wrap.clientHeight;
        const margin = 32;
        if (st.panX > ww - margin) st.panX = ww - margin;
        if (st.panY > wh - margin) st.panY = wh - margin;
        if (st.panX < -(cw - margin)) st.panX = -(cw - margin);
        if (st.panY < -(ch - margin)) st.panY = -(ch - margin);
    }, []);

    const fitCanvas = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const st = stateRef.current;
        const ww = wrap.clientWidth;
        const wh = wrap.clientHeight;
        const fitZoom = Math.min(ww * 0.8 / 1024, wh * 0.8 / 512);
        st.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));
        const cw = 1024 * st.zoom;
        const ch = 512 * st.zoom;
        st.panX = Math.floor((ww - cw) / 2);
        st.panY = Math.floor((wh - ch) / 2);
        onZoomChange(st.zoom);
    }, [onZoomChange]);

    const applyZoom = useCallback((newZoom: number, anchorMx: number, anchorMy: number) => {
        const st = stateRef.current;
        const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
        if (z === st.zoom) return;
        const cpx = (anchorMx - st.panX) / st.zoom;
        const cpy = (anchorMy - st.panY) / st.zoom;
        st.zoom = z;
        st.panX = Math.round(anchorMx - cpx * st.zoom);
        st.panY = Math.round(anchorMy - cpy * st.zoom);
        clampPan();
        updateCanvasTransform();
        renderOverlay();
        onZoomChange(st.zoom);
    }, [clampPan, updateCanvasTransform, renderOverlay, onZoomChange]);

    const setZoomCenter = useCallback((newZoom: number) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        applyZoom(newZoom, rect.width / 2, rect.height / 2);
    }, [applyZoom]);

    // ---- Stamp helper ----
    const stampAt = useCallback((currentMap: number[], currentGfx: number[], tx: number, ty: number) => {
        if (stampTilesRef.current && (stampWRef.current > 1 || stampHRef.current > 1)) {
            for (let sy = 0; sy < stampHRef.current; sy++)
                for (let sx = 0; sx < stampWRef.current; sx++)
                    meSetTile(currentMap, currentGfx, tx + sx, ty + sy, stampTilesRef.current[sy][sx]);
        } else {
            meSetTile(currentMap, currentGfx, tx, ty, fgTileRef.current);
        }
    }, []);

    // ---- Undo helpers ----
    const pushUndo = useCallback(() => {
        undoStackRef.current.push({ map: [...mapRef.current], gfx: [...gfxRef.current] });
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
    }, [undoStackRef, redoStackRef]);

    const doUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        redoStackRef.current.push({ map: [...mapRef.current], gfx: [...gfxRef.current] });
        const prev = undoStackRef.current.pop()!;
        useCartStore.getState().setMap([...prev.map], [...prev.gfx]);
    }, [undoStackRef, redoStackRef]);

    const doRedo = useCallback(() => {
        if (redoStackRef.current.length === 0) return;
        undoStackRef.current.push({ map: [...mapRef.current], gfx: [...gfxRef.current] });
        const next = redoStackRef.current.pop()!;
        useCartStore.getState().setMap([...next.map], [...next.gfx]);
    }, [undoStackRef, redoStackRef]);

    // ---- Cursor ----
    const updateCursor = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const st = stateRef.current;
        if (toolRef.current === 'hand' || st.spaceHeld) {
            wrap.style.cursor = st.isPanning ? 'grabbing' : 'grab';
        } else {
            wrap.style.cursor = 'crosshair';
        }
    }, []);

    // ---- Selection operations ----
    const copySelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        setClipboard({ w: sel.w, h: sel.h, data: meGetSelectionTiles(mapRef.current, gfxRef.current, sel) });
    }, [setClipboard]);

    const cutSelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentMap = [...mapRef.current];
        const currentGfx = [...gfxRef.current];
        setClipboard({ w: sel.w, h: sel.h, data: meGetSelectionTiles(currentMap, currentGfx, sel) });
        meClearTileRect(currentMap, currentGfx, sel.x, sel.y, sel.w, sel.h);
        useCartStore.getState().setMap(currentMap, currentGfx);
    }, [pushUndo, setClipboard]);

    const pasteClipboard = useCallback(() => {
        const clip = clipboardRef.current;
        if (!clip) return;
        pushUndo();
        const currentMap = [...mapRef.current];
        const currentGfx = [...gfxRef.current];
        const tx = mouseTXRef.current >= 0 ? mouseTXRef.current : 0;
        const ty = mouseTYRef.current >= 0 ? mouseTYRef.current : 0;
        mePasteTiles(currentMap, currentGfx, tx, ty, clip.w, clip.h, clip.data);
        setSelection({ x: tx, y: ty, w: clip.w, h: clip.h });
        useCartStore.getState().setMap(currentMap, currentGfx);
    }, [pushUndo, setSelection]);

    const deleteSelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentMap = [...mapRef.current];
        const currentGfx = [...gfxRef.current];
        meClearTileRect(currentMap, currentGfx, sel.x, sel.y, sel.w, sel.h);
        setSelection(null);
        useCartStore.getState().setMap(currentMap, currentGfx);
    }, [pushUndo, setSelection]);

    // ---- Mouse handlers ----
    const onMouseDown = useCallback((e: MouseEvent) => {
        const st = stateRef.current;
        const pos = screenToTile(e.clientX, e.clientY);
        setMouseTX(pos.tx); setMouseTY(pos.ty);

        if (tilePickerVisibleRef.current) return;

        // Middle mouse = pan
        if (e.button === 1) {
            e.preventDefault();
            st.isPanning = true;
            st.panStart = { mx: e.clientX, my: e.clientY, px: st.panX, py: st.panY };
            updateCursor();
            return;
        }

        // Right click = eyedropper
        if (e.button === 2) {
            e.preventDefault();
            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                setFgTile(meGetTile(mapRef.current, gfxRef.current, pos.tx, pos.ty));
                setStampTiles(null); setStampW(1); setStampH(1);
            }
            return;
        }

        if (!editableRef.current) return;

        const currentTool = toolRef.current;

        if (currentTool === 'hand' || st.spaceHeld) {
            st.isPanning = true;
            st.panStart = { mx: e.clientX, my: e.clientY, px: st.panX, py: st.panY };
            updateCursor();
            return;
        }

        if (currentTool === 'pencil') {
            pushUndo();
            st.isDrawing = true;
            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                const currentMap = [...mapRef.current];
                const currentGfx = [...gfxRef.current];
                stampAt(currentMap, currentGfx, pos.tx, pos.ty);
                useCartStore.getState().setMap(currentMap, currentGfx);
            }
        } else if (currentTool === 'fill') {
            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                pushUndo();
                const currentMap = [...mapRef.current];
                const currentGfx = [...gfxRef.current];
                meFloodFill(currentMap, currentGfx, pos.tx, pos.ty, fgTileRef.current);
                useCartStore.getState().setMap(currentMap, currentGfx);
            }
        } else if (currentTool === 'select') {
            const sel = selectionRef.current;
            if (sel && pos.tx >= sel.x && pos.tx < sel.x + sel.w &&
                pos.ty >= sel.y && pos.ty < sel.y + sel.h) {
                st.selDragging = true;
                st.selDragStart = { mx: pos.tx, my: pos.ty, sx: sel.x, sy: sel.y };
                pushUndo();
                const currentMap = [...mapRef.current];
                const currentGfx = [...gfxRef.current];
                const data = meGetSelectionTiles(currentMap, currentGfx, sel);
                meClearTileRect(currentMap, currentGfx, sel.x, sel.y, sel.w, sel.h);
                setSelection({ ...sel, data });
                useCartStore.getState().setMap(currentMap, currentGfx);
            } else {
                setSelection(null);
                st.isDrawing = true;
                st.drawStart = { tx: pos.tx, ty: pos.ty };
            }
        }
    }, [screenToTile, setMouseTX, setMouseTY, pushUndo, updateCursor, setSelection, setFgTile,
        setStampTiles, setStampW, setStampH, stampAt]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        const st = stateRef.current;
        if (tilePickerVisibleRef.current) return;

        const pos = screenToTile(e.clientX, e.clientY);
        setMouseTX(pos.tx); setMouseTY(pos.ty);

        if (st.isPanning && st.panStart) {
            st.panX = st.panStart.px + (e.clientX - st.panStart.mx);
            st.panY = st.panStart.py + (e.clientY - st.panStart.my);
            clampPan();
            updateCanvasTransform();
            renderOverlay();
            return;
        }

        if (!editableRef.current) { renderOverlay(); return; }

        const currentTool = toolRef.current;

        if (st.isDrawing && currentTool === 'pencil') {
            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                const currentMap = [...mapRef.current];
                const currentGfx = [...gfxRef.current];
                stampAt(currentMap, currentGfx, pos.tx, pos.ty);
                useCartStore.getState().setMap(currentMap, currentGfx);
            }
        } else if (st.isDrawing && currentTool === 'select' && st.drawStart) {
            const x0 = Math.min(st.drawStart.tx, pos.tx);
            const y0 = Math.min(st.drawStart.ty, pos.ty);
            const x1 = Math.max(st.drawStart.tx, pos.tx);
            const y1 = Math.max(st.drawStart.ty, pos.ty);
            const cx0 = Math.max(0, Math.min(127, x0));
            const cy0 = Math.max(0, Math.min(63, y0));
            const cx1 = Math.max(0, Math.min(127, x1));
            const cy1 = Math.max(0, Math.min(63, y1));
            setSelection({ x: Math.min(cx0, cx1), y: Math.min(cy0, cy1), w: Math.abs(cx1 - cx0) + 1, h: Math.abs(cy1 - cy0) + 1 });
            renderOverlay();
        } else if (st.selDragging && st.selDragStart && selectionRef.current) {
            const dx = pos.tx - st.selDragStart.mx;
            const dy = pos.ty - st.selDragStart.my;
            setSelection({ ...selectionRef.current, x: st.selDragStart.sx + dx, y: st.selDragStart.sy + dy });
            renderOverlay();
        } else {
            renderOverlay();
        }
    }, [screenToTile, setMouseTX, setMouseTY, clampPan, updateCanvasTransform, renderOverlay, setSelection, stampAt]);

    const onMouseUp = useCallback((e: MouseEvent) => {
        const st = stateRef.current;

        if (st.isPanning) {
            st.isPanning = false;
            st.panStart = null;
            updateCursor();
            return;
        }

        if (!editableRef.current) return;

        const currentTool = toolRef.current;

        if (st.isDrawing && currentTool === 'pencil') {
            st.isDrawing = false;
        } else if (st.isDrawing && currentTool === 'select') {
            st.isDrawing = false;
            st.drawStart = null;
            const sel = selectionRef.current;
            if (sel && (sel.w <= 0 || sel.h <= 0)) setSelection(null);
            renderOverlay();
        }

        if (st.selDragging && selectionRef.current && selectionRef.current.data) {
            const sel = selectionRef.current;
            const currentMap = [...mapRef.current];
            const currentGfx = [...gfxRef.current];
            mePasteTiles(currentMap, currentGfx, sel.x, sel.y, sel.w, sel.h, sel.data);
            setSelection({ ...sel, data: null });
            st.selDragging = false;
            st.selDragStart = null;
            useCartStore.getState().setMap(currentMap, currentGfx);
        }
    }, [updateCursor, renderOverlay, setSelection]);

    const onWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const st = stateRef.current;
        if (st.spaceHeld || toolRef.current === 'hand') {
            st.panX -= e.deltaX;
            st.panY -= e.deltaY;
            clampPan();
            updateCanvasTransform();
            renderOverlay();
            return;
        }
        const pos = screenToTile(e.clientX, e.clientY);
        let delta = -e.deltaY;
        if (e.deltaMode === 1) delta *= 30;
        else if (e.deltaMode === 2) delta *= 300;
        const factor = Math.pow(ZOOM_FACTOR, delta / 50);
        applyZoom(st.zoom * factor, pos.mx, pos.my);
    }, [clampPan, updateCanvasTransform, renderOverlay, screenToTile, applyZoom]);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
        if (activeTab !== 'map') return;
        const st = stateRef.current;
        const key = e.key.toLowerCase();

        // Tile picker toggle
        if (key === 'x' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setTilePickerVisible(!tilePickerVisibleRef.current);
            return;
        }

        if (tilePickerVisibleRef.current) {
            if (key === 'escape') { e.preventDefault(); setTilePickerVisible(false); return; }
            if (key === 'q' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setFgTile((fgTileRef.current - 1 + 256) % 256);
                setStampTiles(null); setStampW(1); setStampH(1);
                return;
            }
            if (key === 'w' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setFgTile((fgTileRef.current + 1) % 256);
                setStampTiles(null); setStampW(1); setStampH(1);
                return;
            }
            return;
        }

        // Space for temporary hand
        if (key === ' ' && !st.spaceHeld) {
            e.preventDefault();
            st.spaceHeld = true;
            st.prevTool = toolRef.current;
            setTool('hand');
            updateCursor();
            return;
        }

        // Q/W = prev/next tile
        if (key === 'q' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setFgTile((fgTileRef.current - 1 + 256) % 256);
            setStampTiles(null); setStampW(1); setStampH(1);
            return;
        }
        if (key === 'w' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setFgTile((fgTileRef.current + 1) % 256);
            setStampTiles(null); setStampW(1); setStampH(1);
            return;
        }

        // Zoom
        if (key === '=' || key === '+') { e.preventDefault(); setZoomCenter(st.zoom * 1.5); return; }
        if (key === '-') { e.preventDefault(); setZoomCenter(st.zoom / 1.5); return; }
        if (key === '0') { e.preventDefault(); fitCanvas(); updateCanvasTransform(); renderOverlay(); return; }

        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey && editableRef.current) { e.preventDefault(); doUndo(); return; }
        if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey && editableRef.current) { e.preventDefault(); doRedo(); return; }
        if ((e.ctrlKey || e.metaKey) && key === 'y' && editableRef.current) { e.preventDefault(); doRedo(); return; }

        // Copy/Cut/Paste
        if ((e.ctrlKey || e.metaKey) && key === 'c' && toolRef.current === 'select' && editableRef.current) { e.preventDefault(); copySelection(); return; }
        if ((e.ctrlKey || e.metaKey) && key === 'x' && toolRef.current === 'select' && editableRef.current) { e.preventDefault(); cutSelection(); return; }
        if ((e.ctrlKey || e.metaKey) && key === 'v' && editableRef.current) { e.preventDefault(); pasteClipboard(); return; }

        if (!editableRef.current) return;

        // Tool shortcuts
        if (key === 'd' && !e.ctrlKey) { setTool('pencil'); updateCursor(); return; }
        if (key === 'f' && !e.ctrlKey) { setTool('fill'); updateCursor(); return; }
        if (key === 's' && !e.ctrlKey && !e.metaKey) { setTool('select'); updateCursor(); return; }
        if (key === 'p' && !e.ctrlKey) { setTool('hand'); updateCursor(); return; }

        // Selection operations
        if (toolRef.current === 'select' && selectionRef.current) {
            if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelection(); return; }
            if (key === 'escape') { setSelection(null); renderOverlay(); return; }
        }
    }, [activeTab, setTool, updateCursor, setZoomCenter, fitCanvas, updateCanvasTransform, renderOverlay,
        doUndo, doRedo, copySelection, cutSelection, pasteClipboard, setSelection, deleteSelection,
        setFgTile, setStampTiles, setStampW, setStampH, setTilePickerVisible]);

    const onKeyUp = useCallback((e: KeyboardEvent) => {
        const st = stateRef.current;
        if (e.key === ' ' && st.spaceHeld) {
            st.spaceHeld = false;
            if (st.prevTool) setTool(st.prevTool);
            st.prevTool = null;
            updateCursor();
        }
    }, [setTool, updateCursor]);

    // ---- Setup ----
    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        wrap.addEventListener('mousedown', onMouseDown);
        wrap.addEventListener('contextmenu', (e) => e.preventDefault());
        wrap.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const marchingTimer = setInterval(() => {
            if (selectionRef.current) {
                stateRef.current.marchingAntsOffset = (stateRef.current.marchingAntsOffset + 1) % 8;
                renderOverlay();
            }
        }, 150);

        fitCanvas();
        renderCanvas();

        return () => {
            wrap.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            clearInterval(marchingTimer);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-render when data changes
    useEffect(() => {
        renderCanvas();
    }, [map, gfx, renderCanvas]);

    // Re-fit canvas when map tab becomes visible
    useEffect(() => {
        if (activeTab === 'map') {
            fitCanvas();
            updateCanvasTransform();
            renderCanvas();
        }
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        renderOverlay();
    }, [selection, showScreenBounds, renderOverlay]);

    return (
        <div
            ref={wrapRef}
            className="map-canvas-container"
            style={{ position: 'relative', overflow: 'hidden' }}
        >
            <canvas
                ref={cvsRef}
                width={1024}
                height={512}
                style={{ position: 'absolute', imageRendering: 'pixelated' }}
            />
            <canvas
                ref={overlayRef}
                width={1024}
                height={512}
                style={{ position: 'absolute' }}
            />
        </div>
    );
}

// Export getSprite for use in TilePicker
export { getSprite, PALETTE_RGBA };
