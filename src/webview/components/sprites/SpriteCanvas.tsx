import { useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore, type SpriteTool } from '../../store/uiStore';
import { PICO8_PALETTE } from '../../types';

// Convert PICO8_PALETTE to hex strings
const PAL = PICO8_PALETTE.map(([r, g, b]) => `rgb(${r},${g},${b})`);

// ---- GFX pixel helpers ----

function getGfxPixel(gfx: number[], x: number, y: number): number {
    if (x < 0 || x >= 128 || y < 0 || y >= 128) return 0;
    const byteIdx = y * 64 + Math.floor(x / 2);
    const b = gfx[byteIdx] || 0;
    return (x % 2 === 0) ? (b & 0x0f) : ((b >> 4) & 0x0f);
}

function setGfxPixel(gfx: number[], x: number, y: number, c: number): void {
    if (x < 0 || x >= 128 || y < 0 || y >= 128) return;
    const byteIdx = y * 64 + Math.floor(x / 2);
    const b = gfx[byteIdx] || 0;
    if (x % 2 === 0) {
        gfx[byteIdx] = (b & 0xf0) | (c & 0x0f);
    } else {
        gfx[byteIdx] = (b & 0x0f) | ((c & 0x0f) << 4);
    }
}

// ---- Drawing algorithms ----

function drawBresenhamLine(gfx: number[], x0: number, y0: number, x1: number, y1: number, color: number): void {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
        setGfxPixel(gfx, x0, y0, color);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

function drawRect(gfx: number[], x0: number, y0: number, x1: number, y1: number, color: number, filled: boolean): void {
    const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
    const rx2 = Math.max(x0, x1), ry2 = Math.max(y0, y1);
    if (filled) {
        for (let yy = ry; yy <= ry2; yy++)
            for (let xx = rx; xx <= rx2; xx++)
                setGfxPixel(gfx, xx, yy, color);
    } else {
        for (let xx = rx; xx <= rx2; xx++) { setGfxPixel(gfx, xx, ry, color); setGfxPixel(gfx, xx, ry2, color); }
        for (let yy = ry; yy <= ry2; yy++) { setGfxPixel(gfx, rx, yy, color); setGfxPixel(gfx, rx2, yy, color); }
    }
}

function drawEllipse(gfx: number[], x0: number, y0: number, x1: number, y1: number, color: number, filled: boolean): void {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let a = Math.abs(x1 - x0) / 2, b = Math.abs(y1 - y0) / 2;
    if (a < 0.5 && b < 0.5) { setGfxPixel(gfx, Math.round(cx), Math.round(cy), color); return; }
    if (a < 0.5) a = 0.5;
    if (b < 0.5) b = 0.5;
    const a2 = a * a, b2 = b * b;
    const plotPoints = filled ? (cx: number, cy: number, x: number, y: number) => {
        for (let i = Math.ceil(cx - x); i <= Math.floor(cx + x); i++) {
            setGfxPixel(gfx, i, Math.round(cy + y), color);
            setGfxPixel(gfx, i, Math.round(cy - y), color);
        }
    } : (cx: number, cy: number, x: number, y: number) => {
        setGfxPixel(gfx, Math.round(cx + x), Math.round(cy + y), color);
        setGfxPixel(gfx, Math.round(cx - x), Math.round(cy + y), color);
        setGfxPixel(gfx, Math.round(cx + x), Math.round(cy - y), color);
        setGfxPixel(gfx, Math.round(cx - x), Math.round(cy - y), color);
    };
    // Region 1
    let x = 0, y = b;
    let d1 = b2 - a2 * b + 0.25 * a2;
    let dx = 2 * b2 * x, dy = 2 * a2 * y;
    while (dx < dy) {
        plotPoints(cx, cy, x, y);
        if (d1 < 0) { x++; dx += 2 * b2; d1 += dx + b2; }
        else { x++; y--; dx += 2 * b2; dy -= 2 * a2; d1 += dx - dy + b2; }
    }
    // Region 2
    let d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2;
    while (y >= 0) {
        plotPoints(cx, cy, x, y);
        if (d2 > 0) { y--; dy -= 2 * a2; d2 += a2 - dy; }
        else { y--; x++; dx += 2 * b2; dy -= 2 * a2; d2 += dx - dy + a2; }
    }
}

function floodFill(gfx: number[], startX: number, startY: number, fillColor: number): void {
    const targetColor = getGfxPixel(gfx, startX, startY);
    if (targetColor === fillColor) return;
    const stack: number[][] = [[startX, startY]];
    const visited: Record<string, boolean> = {};
    while (stack.length > 0) {
        const p = stack.pop()!;
        const x = p[0], y = p[1];
        if (x < 0 || x >= 128 || y < 0 || y >= 128) continue;
        const key = x + ',' + y;
        if (visited[key]) continue;
        if (getGfxPixel(gfx, x, y) !== targetColor) continue;
        visited[key] = true;
        setGfxPixel(gfx, x, y, fillColor);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
}

function searchReplace(gfx: number[], targetColor: number, replaceColor: number): void {
    if (targetColor === replaceColor) return;
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++)
            if (getGfxPixel(gfx, x, y) === targetColor) setGfxPixel(gfx, x, y, replaceColor);
}

function snapLine45(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
    const dx = x1 - x0, dy = y1 - y0;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx > ady * 2) return { x: x1, y: y0 };
    if (ady > adx * 2) return { x: x0, y: y1 };
    const d = Math.max(adx, ady);
    return { x: x0 + d * (dx >= 0 ? 1 : -1), y: y0 + d * (dy >= 0 ? 1 : -1) };
}

function constrainSquare(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: x0 + d * (dx >= 0 ? 1 : -1), y: y0 + d * (dy >= 0 ? 1 : -1) };
}

// ---- Selection helpers ----

interface Selection {
    x: number; y: number; w: number; h: number;
    data?: number[] | null;
}

function getSelectionPixels(gfx: number[], sel: Selection): number[] {
    const data: number[] = [];
    for (let y = 0; y < sel.h; y++)
        for (let x = 0; x < sel.w; x++)
            data.push(getGfxPixel(gfx, sel.x + x, sel.y + y));
    return data;
}

function pastePixels(gfx: number[], px: number, py: number, w: number, h: number, data: number[]): void {
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            setGfxPixel(gfx, px + x, py + y, data[y * w + x]);
}

function clearRect(gfx: number[], x: number, y: number, w: number, h: number, color: number): void {
    for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++)
            setGfxPixel(gfx, x + xx, y + yy, color);
}

// ---- Constants ----
const ZOOM_MIN = 2;
const ZOOM_MAX = 64;
const ZOOM_FACTOR = 1.08;
const FLAG_COLORS = [PAL[8], PAL[9], PAL[10], PAL[11], PAL[12], PAL[13], PAL[14], PAL[15]];

interface SpriteCanvasProps {
    mouseX: number;
    mouseY: number;
    setMouseX: (x: number) => void;
    setMouseY: (y: number) => void;
    flagFilter: boolean[];
    selection: Selection | null;
    setSelection: (sel: Selection | null) => void;
    clipboard: { w: number; h: number; data: number[] } | null;
    setClipboard: (clip: { w: number; h: number; data: number[] } | null) => void;
    undoStackRef: React.MutableRefObject<number[][]>;
    redoStackRef: React.MutableRefObject<number[][]>;
    quickPaletteVisible: boolean;
    setQuickPaletteVisible: (v: boolean) => void;
    quickPalettePos: { x: number; y: number };
    setQuickPalettePos: (p: { x: number; y: number }) => void;
    onHoveredSpriteChange: (idx: number) => void;
}

export function SpriteCanvas({
    mouseX, mouseY, setMouseX, setMouseY,
    flagFilter,
    selection, setSelection,
    clipboard, setClipboard,
    undoStackRef, redoStackRef,
    quickPaletteVisible, setQuickPaletteVisible,
    quickPalettePos, setQuickPalettePos,
    onHoveredSpriteChange,
}: SpriteCanvasProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const cvsRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    // Mutable state refs (imperative canvas logic)
    const stateRef = useRef({
        zoom: 4,
        panX: 0,
        panY: 0,
        isDrawing: false,
        drawStart: null as { x: number; y: number } | null,
        isPanning: false,
        panStart: null as { mx: number; my: number; px: number; py: number } | null,
        spaceHeld: false,
        prevTool: null as SpriteTool | null,
        prevPx: -1,
        prevPy: -1,
        selDragging: false,
        selDragStart: null as { mx: number; my: number; sx: number; sy: number } | null,
        marchingAntsOffset: 0,
        lastHoveredSprite: -1,
        fitted: false,
    });

    const gfx = useCartStore((s) => s.gfx);
    const flags = useCartStore((s) => s.flags);
    const setGfx = useCartStore((s) => s.setGfx);
    const setFlags = useCartStore((s) => s.setFlags);
    const tool = useUIStore((s) => s.spriteTool);
    const fgColor = useUIStore((s) => s.spriteFgColor);
    const bgColor = useUIStore((s) => s.spriteBgColor);
    const setTool = useUIStore((s) => s.setSpriteTool);
    const setFgColor = useUIStore((s) => s.setSpriteFgColor);
    const editable = useUIStore((s) => s.editable);
    const activeTab = useUIStore((s) => s.activeTab);

    // Refs that track latest store values for event handlers
    const toolRef = useRef(tool);
    toolRef.current = tool;
    const fgRef = useRef(fgColor);
    fgRef.current = fgColor;
    const bgRef = useRef(bgColor);
    bgRef.current = bgColor;
    const editableRef = useRef(editable);
    editableRef.current = editable;
    const gfxRef = useRef(gfx);
    gfxRef.current = gfx;
    const flagsRef = useRef(flags);
    flagsRef.current = flags;
    const selectionRef = useRef(selection);
    selectionRef.current = selection;
    const clipboardRef = useRef(clipboard);
    clipboardRef.current = clipboard;
    const flagFilterRef = useRef(flagFilter);
    flagFilterRef.current = flagFilter;
    const mouseXRef = useRef(mouseX);
    mouseXRef.current = mouseX;
    const mouseYRef = useRef(mouseY);
    mouseYRef.current = mouseY;

    // ---- Coordinate conversion ----
    const screenToPixel = useCallback((clientX: number, clientY: number) => {
        const wrap = wrapRef.current;
        if (!wrap) return { px: -1, py: -1, mx: 0, my: 0 };
        const rect = wrap.getBoundingClientRect();
        const st = stateRef.current;
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        const px = Math.floor((mx - st.panX) / st.zoom);
        const py = Math.floor((my - st.panY) / st.zoom);
        return { px, py, mx, my };
    }, []);

    // ---- Canvas rendering ----
    const renderCanvas = useCallback(() => {
        const cvs = cvsRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        const currentGfx = gfxRef.current;
        const wrap = wrapRef.current;
        console.log('[pico8ide] SpriteCanvas.renderCanvas: gfx length:', currentGfx?.length, 'nonzero bytes:', currentGfx?.filter((v: number) => v !== 0).length, 'wrap dims:', wrap?.clientWidth, 'x', wrap?.clientHeight);
        const imgData = ctx.createImageData(128, 128);
        for (let i = 0; i < 8192; i++) {
            const byte = currentGfx[i] || 0;
            const p1 = byte & 0x0f;
            const p2 = (byte >> 4) & 0x0f;
            const row = Math.floor(i / 64);
            const col = (i % 64) * 2;
            const c1 = PICO8_PALETTE[p1];
            const c2 = PICO8_PALETTE[p2];
            const idx1 = (row * 128 + col) * 4;
            imgData.data[idx1] = c1[0]; imgData.data[idx1 + 1] = c1[1]; imgData.data[idx1 + 2] = c1[2]; imgData.data[idx1 + 3] = 255;
            const idx2 = (row * 128 + col + 1) * 4;
            imgData.data[idx2] = c2[0]; imgData.data[idx2 + 1] = c2[1]; imgData.data[idx2 + 2] = c2[2]; imgData.data[idx2 + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        updateCanvasTransform();
        renderOverlay();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateCanvasTransform = useCallback(() => {
        const cvs = cvsRef.current;
        const overlay = overlayRef.current;
        if (!cvs || !overlay) return;
        const st = stateRef.current;
        const size = 128 * st.zoom;
        const s = size + 'px';
        cvs.style.width = s; cvs.style.height = s;
        cvs.style.left = st.panX + 'px'; cvs.style.top = st.panY + 'px';
        overlay.width = size; overlay.height = size;
        overlay.style.width = s; overlay.style.height = s;
        overlay.style.left = st.panX + 'px'; overlay.style.top = st.panY + 'px';
    }, []);

    const renderShapePreview = useCallback((ctx: CanvasRenderingContext2D) => {
        const st = stateRef.current;
        if (!st.drawStart || mouseXRef.current < 0) return;
        const x0 = st.drawStart.x, y0 = st.drawStart.y;
        const x1 = mouseXRef.current, y1 = mouseYRef.current;
        const currentTool = toolRef.current;
        ctx.strokeStyle = PAL[fgRef.current];
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = st.zoom;
        if (currentTool === 'rect') {
            const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
            const rw = Math.abs(x1 - x0) + 1, rh = Math.abs(y1 - y0) + 1;
            ctx.strokeRect(rx * st.zoom + st.zoom / 2, ry * st.zoom + st.zoom / 2, (rw - 1) * st.zoom, (rh - 1) * st.zoom);
        } else if (currentTool === 'circle') {
            const cx = (x0 + x1) / 2 * st.zoom + st.zoom / 2;
            const cy = (y0 + y1) / 2 * st.zoom + st.zoom / 2;
            const rx = Math.abs(x1 - x0) / 2 * st.zoom;
            const ry = Math.abs(y1 - y0) / 2 * st.zoom;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (currentTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(x0 * st.zoom + st.zoom / 2, y0 * st.zoom + st.zoom / 2);
            ctx.lineTo(x1 * st.zoom + st.zoom / 2, y1 * st.zoom + st.zoom / 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }, []);

    const renderOverlay = useCallback(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        const st = stateRef.current;
        const currentFlags = flagsRef.current;
        const currentFlagFilter = flagFilterRef.current;
        const sel = selectionRef.current;
        const mX = mouseXRef.current, mY = mouseYRef.current;
        const size = 128 * st.zoom;
        ctx.clearRect(0, 0, size, size);

        // Sprite grid at zoom >= 2
        if (st.zoom >= 2) {
            ctx.strokeStyle = 'rgba(102,102,102,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let gx = 0; gx <= 128; gx += 8) {
                ctx.moveTo(gx * st.zoom + 0.5, 0);
                ctx.lineTo(gx * st.zoom + 0.5, size);
            }
            for (let gy = 0; gy <= 128; gy += 8) {
                ctx.moveTo(0, gy * st.zoom + 0.5);
                ctx.lineTo(size, gy * st.zoom + 0.5);
            }
            ctx.stroke();
        }

        // Pixel grid at zoom >= 8
        if (st.zoom >= 8) {
            ctx.strokeStyle = 'rgba(51,51,51,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let px = 0; px <= 128; px++) {
                if (px % 8 === 0) continue;
                ctx.moveTo(px * st.zoom + 0.5, 0);
                ctx.lineTo(px * st.zoom + 0.5, size);
            }
            for (let py = 0; py <= 128; py++) {
                if (py % 8 === 0) continue;
                ctx.moveTo(0, py * st.zoom + 0.5);
                ctx.lineTo(size, py * st.zoom + 0.5);
            }
            ctx.stroke();
        }

        // Flag filter overlay
        const anyFlagActive = currentFlagFilter.indexOf(true) >= 0;
        if (anyFlagActive) {
            for (let si = 0; si < 256; si++) {
                const flagByte = currentFlags[si] || 0;
                if (flagByte === 0) continue;
                let matchColor: string | null = null;
                for (let fi = 0; fi < 8; fi++) {
                    if (currentFlagFilter[fi] && (flagByte & (1 << fi))) {
                        matchColor = FLAG_COLORS[fi];
                        break;
                    }
                }
                if (matchColor) {
                    const sx = (si % 16) * 8;
                    const sy = Math.floor(si / 16) * 8;
                    ctx.strokeStyle = matchColor;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(sx * st.zoom + 1, sy * st.zoom + 1, 8 * st.zoom - 2, 8 * st.zoom - 2);
                }
            }
            ctx.lineWidth = 1;
        }

        // Hover pixel highlight
        if (mX >= 0 && mX < 128 && mY >= 0 && mY < 128) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(mX * st.zoom + 0.5, mY * st.zoom + 0.5, st.zoom - 1, st.zoom - 1);
            const cellX = Math.floor(mX / 8) * 8;
            const cellY = Math.floor(mY / 8) * 8;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX * st.zoom + 0.5, cellY * st.zoom + 0.5, 8 * st.zoom - 1, 8 * st.zoom - 1);
        }

        // Selection marching ants
        if (sel && !st.selDragging) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = st.marchingAntsOffset;
            ctx.strokeRect(sel.x * st.zoom + 0.5, sel.y * st.zoom + 0.5, sel.w * st.zoom, sel.h * st.zoom);
            ctx.setLineDash([]);
        }

        // Show lifted selection pixels during drag
        if (sel && st.selDragging && sel.data) {
            ctx.globalAlpha = 0.7;
            for (let dy = 0; dy < sel.h; dy++) {
                for (let dx = 0; dx < sel.w; dx++) {
                    const c = sel.data[dy * sel.w + dx];
                    ctx.fillStyle = PAL[c];
                    ctx.fillRect((sel.x + dx) * st.zoom, (sel.y + dy) * st.zoom, st.zoom, st.zoom);
                }
            }
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = st.marchingAntsOffset;
            ctx.strokeRect(sel.x * st.zoom + 0.5, sel.y * st.zoom + 0.5, sel.w * st.zoom, sel.h * st.zoom);
            ctx.setLineDash([]);
        }

        // Shape preview while dragging
        if (st.isDrawing && st.drawStart) {
            const t = toolRef.current;
            if (t === 'rect' || t === 'circle' || t === 'line') {
                renderShapePreview(ctx);
            }
        }
    }, [renderShapePreview]);

    // ---- Pan/Zoom helpers ----
    const clampPan = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const st = stateRef.current;
        const cw = 128 * st.zoom;
        const ch = 128 * st.zoom;
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
        const fitZoom = Math.min(ww * 0.8 / 128, wh * 0.8 / 128);
        st.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));
        const cw = 128 * st.zoom;
        const ch = 128 * st.zoom;
        st.panX = Math.floor((ww - cw) / 2);
        st.panY = Math.floor((wh - ch) / 2);
    }, []);

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
    }, [clampPan, updateCanvasTransform, renderOverlay]);

    const setZoomCenter = useCallback((newZoom: number) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        applyZoom(newZoom, rect.width / 2, rect.height / 2);
    }, [applyZoom]);

    // ---- Undo helpers ----
    const pushUndo = useCallback(() => {
        undoStackRef.current.push([...gfxRef.current]);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
    }, [undoStackRef, redoStackRef]);

    const doUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        redoStackRef.current.push([...gfxRef.current]);
        const prev = undoStackRef.current.pop()!;
        const newGfx = [...prev];
        useCartStore.getState().setGfx(newGfx);
    }, [undoStackRef, redoStackRef]);

    const doRedo = useCallback(() => {
        if (redoStackRef.current.length === 0) return;
        undoStackRef.current.push([...gfxRef.current]);
        const next = redoStackRef.current.pop()!;
        const newGfx = [...next];
        useCartStore.getState().setGfx(newGfx);
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

    // ---- Selection operations (exposed in keyboard handler) ----
    const flipH = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        const data = getSelectionPixels(currentGfx, sel);
        const w = sel.w, h = sel.h;
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                setGfxPixel(currentGfx, sel.x + x, sel.y + y, data[y * w + (w - 1 - x)]);
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo]);

    const flipV = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        const data = getSelectionPixels(currentGfx, sel);
        const w = sel.w, h = sel.h;
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                setGfxPixel(currentGfx, sel.x + x, sel.y + y, data[(h - 1 - y) * w + x]);
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo]);

    const rotate90 = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        const data = getSelectionPixels(currentGfx, sel);
        const w = sel.w, h = sel.h;
        clearRect(currentGfx, sel.x, sel.y, w, h, bgRef.current);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                setGfxPixel(currentGfx, sel.x + (h - 1 - y), sel.y + x, data[y * w + x]);
        setSelection({ ...sel, w: h, h: w });
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo, setSelection]);

    const shiftSelection = useCallback((dx: number, dy: number) => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        const data = getSelectionPixels(currentGfx, sel);
        clearRect(currentGfx, sel.x, sel.y, sel.w, sel.h, bgRef.current);
        const newSel = { ...sel, x: sel.x + dx, y: sel.y + dy };
        pastePixels(currentGfx, newSel.x, newSel.y, newSel.w, newSel.h, data);
        setSelection(newSel);
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo, setSelection]);

    const copySelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        setClipboard({ w: sel.w, h: sel.h, data: getSelectionPixels(gfxRef.current, sel) });
    }, [setClipboard]);

    const cutSelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        setClipboard({ w: sel.w, h: sel.h, data: getSelectionPixels(currentGfx, sel) });
        clearRect(currentGfx, sel.x, sel.y, sel.w, sel.h, bgRef.current);
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo, setClipboard]);

    const pasteClipboard = useCallback(() => {
        const clip = clipboardRef.current;
        if (!clip) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        const px = mouseXRef.current >= 0 ? mouseXRef.current : 0;
        const py = mouseYRef.current >= 0 ? mouseYRef.current : 0;
        pastePixels(currentGfx, px, py, clip.w, clip.h, clip.data);
        setSelection({ x: px, y: py, w: clip.w, h: clip.h });
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo, setSelection]);

    const deleteSelection = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        pushUndo();
        const currentGfx = [...gfxRef.current];
        clearRect(currentGfx, sel.x, sel.y, sel.w, sel.h, bgRef.current);
        setSelection(null);
        useCartStore.getState().setGfx(currentGfx);
    }, [pushUndo, setSelection]);

    // ---- Mouse handlers ----
    const onMouseDown = useCallback((e: MouseEvent) => {
        const st = stateRef.current;
        const pos = screenToPixel(e.clientX, e.clientY);
        setMouseX(pos.px); setMouseY(pos.py);

        if (quickPaletteVisible) { setQuickPaletteVisible(false); return; }

        // Middle mouse = pan
        if (e.button === 1) {
            e.preventDefault();
            st.isPanning = true;
            st.panStart = { mx: e.clientX, my: e.clientY, px: st.panX, py: st.panY };
            updateCursor();
            return;
        }

        // Right click = color pick
        if (e.button === 2) {
            e.preventDefault();
            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                useUIStore.getState().setSpriteFgColor(getGfxPixel(gfxRef.current, pos.px, pos.py));
            }
            return;
        }

        if (!editableRef.current) return;

        const currentTool = toolRef.current;

        // Hand tool or space held
        if (currentTool === 'hand' || st.spaceHeld) {
            st.isPanning = true;
            st.panStart = { mx: e.clientX, my: e.clientY, px: st.panX, py: st.panY };
            updateCursor();
            return;
        }

        if (currentTool === 'pencil') {
            if (e.ctrlKey || e.metaKey) {
                if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                    pushUndo();
                    const currentGfx = [...gfxRef.current];
                    searchReplace(currentGfx, getGfxPixel(currentGfx, pos.px, pos.py), fgRef.current);
                    useCartStore.getState().setGfx(currentGfx);
                }
                return;
            }
            pushUndo();
            st.isDrawing = true;
            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                const currentGfx = [...gfxRef.current];
                setGfxPixel(currentGfx, pos.px, pos.py, fgRef.current);
                st.prevPx = pos.px;
                st.prevPy = pos.py;
                useCartStore.getState().setGfx(currentGfx);
            }
        } else if (currentTool === 'fill') {
            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                pushUndo();
                const currentGfx = [...gfxRef.current];
                floodFill(currentGfx, pos.px, pos.py, fgRef.current);
                useCartStore.getState().setGfx(currentGfx);
            }
        } else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line') {
            pushUndo();
            st.isDrawing = true;
            st.drawStart = { x: pos.px, y: pos.py };
        } else if (currentTool === 'select') {
            const sel = selectionRef.current;
            if (sel && pos.px >= sel.x && pos.px < sel.x + sel.w &&
                pos.py >= sel.y && pos.py < sel.y + sel.h) {
                st.selDragging = true;
                st.selDragStart = { mx: pos.px, my: pos.py, sx: sel.x, sy: sel.y };
                pushUndo();
                const currentGfx = [...gfxRef.current];
                const data = getSelectionPixels(currentGfx, sel);
                clearRect(currentGfx, sel.x, sel.y, sel.w, sel.h, bgRef.current);
                setSelection({ ...sel, data });
                useCartStore.getState().setGfx(currentGfx);
            } else {
                setSelection(null);
                st.isDrawing = true;
                st.drawStart = { x: pos.px, y: pos.py };
            }
        }
    }, [screenToPixel, setMouseX, setMouseY, pushUndo, updateCursor, setSelection, quickPaletteVisible, setQuickPaletteVisible]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        const st = stateRef.current;
        const pos = screenToPixel(e.clientX, e.clientY);
        setMouseX(pos.px); setMouseY(pos.py);

        // Track hovered sprite
        const curSpr = (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128)
            ? Math.floor(pos.py / 8) * 16 + Math.floor(pos.px / 8) : -1;
        if (curSpr !== st.lastHoveredSprite) {
            st.lastHoveredSprite = curSpr;
            onHoveredSpriteChange(curSpr);
        }

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
            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                const currentGfx = [...gfxRef.current];
                if (st.prevPx >= 0 && st.prevPy >= 0) {
                    drawBresenhamLine(currentGfx, st.prevPx, st.prevPy, pos.px, pos.py, fgRef.current);
                } else {
                    setGfxPixel(currentGfx, pos.px, pos.py, fgRef.current);
                }
                st.prevPx = pos.px;
                st.prevPy = pos.py;
                useCartStore.getState().setGfx(currentGfx);
            }
        } else if (st.isDrawing && (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line')) {
            renderOverlay();
        } else if (st.isDrawing && currentTool === 'select' && st.drawStart) {
            const x0 = Math.min(st.drawStart.x, pos.px);
            const y0 = Math.min(st.drawStart.y, pos.py);
            const x1 = Math.max(st.drawStart.x, pos.px);
            const y1 = Math.max(st.drawStart.y, pos.py);
            const cx0 = Math.max(0, Math.min(127, x0));
            const cy0 = Math.max(0, Math.min(127, y0));
            const cx1 = Math.max(0, Math.min(127, x1));
            const cy1 = Math.max(0, Math.min(127, y1));
            setSelection({ x: Math.min(cx0, cx1), y: Math.min(cy0, cy1), w: Math.abs(cx1 - cx0) + 1, h: Math.abs(cy1 - cy0) + 1 });
            renderOverlay();
        } else if (st.selDragging && st.selDragStart && selectionRef.current) {
            const dx = pos.px - st.selDragStart.mx;
            const dy = pos.py - st.selDragStart.my;
            setSelection({ ...selectionRef.current, x: st.selDragStart.sx + dx, y: st.selDragStart.sy + dy });
            renderOverlay();
        } else {
            renderOverlay();
        }
    }, [screenToPixel, setMouseX, setMouseY, clampPan, updateCanvasTransform, renderOverlay, setSelection, onHoveredSpriteChange]);

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
            st.prevPx = -1;
            st.prevPy = -1;
        } else if (st.isDrawing && st.drawStart) {
            const pos = screenToPixel(e.clientX, e.clientY);
            let x0 = st.drawStart.x, y0 = st.drawStart.y;
            let x1 = pos.px, y1 = pos.py;

            if (currentTool === 'select') {
                st.isDrawing = false;
                st.drawStart = null;
                const sel = selectionRef.current;
                if (sel && (sel.w <= 0 || sel.h <= 0)) setSelection(null);
                renderOverlay();
                return;
            }

            if (e.shiftKey) {
                if (currentTool === 'line') { const sn = snapLine45(x0, y0, x1, y1); x1 = sn.x; y1 = sn.y; }
                else { const sq = constrainSquare(x0, y0, x1, y1); x1 = sq.x; y1 = sq.y; }
            }

            const filled = e.ctrlKey || e.metaKey;
            const currentGfx = [...gfxRef.current];

            if (currentTool === 'rect') {
                drawRect(currentGfx, x0, y0, x1, y1, fgRef.current, filled);
            } else if (currentTool === 'circle') {
                drawEllipse(currentGfx, x0, y0, x1, y1, fgRef.current, filled);
            } else if (currentTool === 'line') {
                drawBresenhamLine(currentGfx, x0, y0, x1, y1, fgRef.current);
            }

            st.isDrawing = false;
            st.drawStart = null;
            useCartStore.getState().setGfx(currentGfx);
        }

        if (st.selDragging && selectionRef.current && selectionRef.current.data) {
            const sel = selectionRef.current;
            const currentGfx = [...gfxRef.current];
            pastePixels(currentGfx, sel.x, sel.y, sel.w, sel.h, sel.data);
            setSelection({ ...sel, data: null });
            st.selDragging = false;
            st.selDragStart = null;
            useCartStore.getState().setGfx(currentGfx);
        }
    }, [screenToPixel, updateCursor, renderOverlay, setSelection]);

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
        const pos = screenToPixel(e.clientX, e.clientY);
        let delta = -e.deltaY;
        if (e.deltaMode === 1) delta *= 30;
        else if (e.deltaMode === 2) delta *= 300;
        const factor = Math.pow(ZOOM_FACTOR, delta / 50);
        applyZoom(st.zoom * factor, pos.mx, pos.my);
    }, [clampPan, updateCanvasTransform, renderOverlay, screenToPixel, applyZoom]);

    const onDblClick = useCallback((e: MouseEvent) => {
        if (!editableRef.current || toolRef.current !== 'select') return;
        const pos = screenToPixel(e.clientX, e.clientY);
        if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
            const cx = Math.floor(pos.px / 8) * 8;
            const cy = Math.floor(pos.py / 8) * 8;
            setSelection({ x: cx, y: cy, w: 8, h: 8 });
            renderOverlay();
        }
    }, [screenToPixel, setSelection, renderOverlay]);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
        if (activeTab !== 'sprites') return;
        const st = stateRef.current;
        const key = e.key.toLowerCase();

        // Quick palette
        if (key === 'x' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const wrap = wrapRef.current;
            if (!wrap) return;
            const rect = wrap.getBoundingClientRect();
            const mx = mouseXRef.current >= 0 ? mouseXRef.current * st.zoom + st.panX : rect.width / 2;
            const my = mouseYRef.current >= 0 ? mouseYRef.current * st.zoom + st.panY : rect.height / 2;
            if (quickPaletteVisible) setQuickPaletteVisible(false);
            else { setQuickPalettePos({ x: mx, y: my }); setQuickPaletteVisible(true); }
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

        // Ctrl+A select all
        if ((e.ctrlKey || e.metaKey) && key === 'a' && toolRef.current === 'select' && editableRef.current) {
            e.preventDefault();
            setSelection({ x: 0, y: 0, w: 128, h: 128 });
            renderOverlay();
            return;
        }

        // Tab = swap fg/bg colors
        if (key === 'tab' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const tmpFg = fgRef.current;
            useUIStore.getState().setSpriteFgColor(bgRef.current);
            useUIStore.getState().setSpriteBgColor(tmpFg);
            return;
        }

        if (!editableRef.current) return;

        // Tool shortcuts
        if (key === 'd' && !e.ctrlKey) { setTool('pencil'); updateCursor(); return; }
        if (key === 'f' && !e.ctrlKey) { setTool('fill'); updateCursor(); return; }
        if (key === 'r' && !e.ctrlKey) { setTool('rect'); updateCursor(); return; }
        if (key === 'c' && !e.ctrlKey && !e.metaKey) { setTool('circle'); updateCursor(); return; }
        if (key === 'l' && !e.ctrlKey) { setTool('line'); updateCursor(); return; }
        if (key === 's' && !e.ctrlKey && !e.metaKey) { setTool('select'); updateCursor(); return; }
        if (key === 'p' && !e.ctrlKey) { setTool('hand'); updateCursor(); return; }

        // Selection operations
        if (toolRef.current === 'select' && selectionRef.current) {
            if (key === 'h') { flipH(); return; }
            if (key === 'v' && !e.ctrlKey) { flipV(); return; }
            if (key === 't') { rotate90(); return; }
            if (key === 'arrowleft') { e.preventDefault(); shiftSelection(-1, 0); return; }
            if (key === 'arrowright') { e.preventDefault(); shiftSelection(1, 0); return; }
            if (key === 'arrowup') { e.preventDefault(); shiftSelection(0, -1); return; }
            if (key === 'arrowdown') { e.preventDefault(); shiftSelection(0, 1); return; }
            if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelection(); return; }
            if (key === 'escape') { setSelection(null); renderOverlay(); return; }
        }
    }, [activeTab, setTool, updateCursor, setZoomCenter, fitCanvas, updateCanvasTransform, renderOverlay,
        doUndo, doRedo, copySelection, cutSelection, pasteClipboard, setSelection, flipH, flipV, rotate90,
        shiftSelection, deleteSelection, quickPaletteVisible, setQuickPaletteVisible, setQuickPalettePos]);

    const onKeyUp = useCallback((e: KeyboardEvent) => {
        const st = stateRef.current;
        if (e.key === ' ' && st.spaceHeld) {
            st.spaceHeld = false;
            if (st.prevTool) setTool(st.prevTool);
            st.prevTool = null;
            updateCursor();
        }
    }, [setTool, updateCursor]);

    // ---- Setup event listeners ----
    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        wrap.addEventListener('mousedown', onMouseDown);
        wrap.addEventListener('contextmenu', (e) => e.preventDefault());
        wrap.addEventListener('dblclick', onDblClick);
        wrap.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const marchingTimer = setInterval(() => {
            const st = stateRef.current;
            if (selectionRef.current) {
                st.marchingAntsOffset = (st.marchingAntsOffset + 1) % 8;
                renderOverlay();
            }
        }, 150);

        // Initial fit + render
        fitCanvas();
        renderCanvas();

        return () => {
            wrap.removeEventListener('mousedown', onMouseDown);
            wrap.removeEventListener('dblclick', onDblClick);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            clearInterval(marchingTimer);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-render when gfx data changes
    useEffect(() => {
        renderCanvas();
    }, [gfx, renderCanvas]);

    // Re-fit canvas when sprites tab becomes visible
    useEffect(() => {
        if (activeTab === 'sprites') {
            const st = stateRef.current;
            if (!st.fitted) {
                fitCanvas();
                st.fitted = true;
            }
            renderCanvas();
        }
    }, [activeTab, fitCanvas, renderCanvas]);

    // Re-render overlay when flags or flag filter changes
    useEffect(() => {
        renderOverlay();
    }, [flags, flagFilter, selection, renderOverlay]);

    return (
        <div
            ref={wrapRef}
            className="sprite-canvas-container"
            style={{ position: 'relative', overflow: 'hidden' }}
        >
            <canvas
                ref={cvsRef}
                width={128}
                height={128}
                style={{ position: 'absolute', imageRendering: 'pixelated' }}
            />
            <canvas
                ref={overlayRef}
                width={128}
                height={128}
                style={{ position: 'absolute' }}
            />
        </div>
    );
}
