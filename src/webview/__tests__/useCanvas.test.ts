import { describe, it, expect } from 'vitest';
import { clientToCanvas } from '../hooks/useCanvas';

describe('clientToCanvas', () => {
    function mockCanvas(left: number, top: number): HTMLCanvasElement {
        return {
            getBoundingClientRect: () => ({
                left, top, right: left + 100, bottom: top + 100,
                width: 100, height: 100, x: left, y: top, toJSON: () => {},
            }),
        } as unknown as HTMLCanvasElement;
    }

    it('converts client coords at zoom=1 pan=0', () => {
        const canvas = mockCanvas(10, 20);
        const { x, y } = clientToCanvas(60, 70, canvas, 1, 0, 0);
        expect(x).toBe(50);
        expect(y).toBe(50);
    });

    it('accounts for zoom', () => {
        const canvas = mockCanvas(0, 0);
        const { x, y } = clientToCanvas(40, 40, canvas, 4, 0, 0);
        expect(x).toBe(10);
        expect(y).toBe(10);
    });

    it('accounts for pan', () => {
        const canvas = mockCanvas(0, 0);
        const { x, y } = clientToCanvas(40, 40, canvas, 1, 20, 10);
        expect(x).toBe(20);
        expect(y).toBe(30);
    });

    it('combined zoom and pan', () => {
        const canvas = mockCanvas(100, 50);
        // clientX=200, rect.left=100, panX=50 => (200-100-50)/2 = 25
        // clientY=150, rect.top=50, panY=25 => (150-50-25)/2 = 37.5
        const { x, y } = clientToCanvas(200, 150, canvas, 2, 50, 25);
        expect(x).toBe(25);
        expect(y).toBe(37.5);
    });
});
