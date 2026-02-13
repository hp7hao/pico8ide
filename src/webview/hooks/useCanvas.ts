import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook for managing a canvas element with DPR-aware rendering.
 * Returns the canvas ref and helper functions.
 */
export function useCanvas(width: number, height: number) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const getContext = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.getContext('2d');
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.imageSmoothingEnabled = false;
        }
    }, [width, height]);

    return { canvasRef, getContext };
}

/**
 * Convert client coordinates to canvas-local coordinates,
 * accounting for zoom and pan.
 */
export function clientToCanvas(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    zoom: number,
    panX: number,
    panY: number
): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - panX) / zoom;
    const y = (clientY - rect.top - panY) / zoom;
    return { x, y };
}
