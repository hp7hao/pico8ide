import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../hooks/useUndoRedo';

describe('useUndoRedo', () => {
    it('starts with nothing to undo or redo', () => {
        const { result } = renderHook(() => useUndoRedo<number[]>());
        expect(result.current.canUndo()).toBe(false);
        expect(result.current.canRedo()).toBe(false);
    });

    it('undo returns null when no history', () => {
        const { result } = renderHook(() => useUndoRedo<string>());
        let val: string | null = null;
        act(() => { val = result.current.undo(); });
        expect(val).toBeNull();
    });

    it('push then undo restores previous snapshot', () => {
        const { result } = renderHook(() => useUndoRedo<number[]>());

        act(() => {
            result.current.pushSnapshot([1, 2, 3]);
            result.current.pushSnapshot([4, 5, 6]);
        });

        expect(result.current.canUndo()).toBe(true);
        expect(result.current.canRedo()).toBe(false);

        let val: number[] | null = null;
        act(() => { val = result.current.undo(); });
        expect(val).toEqual([1, 2, 3]);
    });

    it('redo replays undone snapshot', () => {
        const { result } = renderHook(() => useUndoRedo<string>());

        act(() => {
            result.current.pushSnapshot('a');
            result.current.pushSnapshot('b');
            result.current.pushSnapshot('c');
        });

        let val: string | null = null;
        act(() => { val = result.current.undo(); }); // back to 'b'
        act(() => { val = result.current.undo(); }); // back to 'a'
        expect(val).toBe('a');

        expect(result.current.canRedo()).toBe(true);
        act(() => { val = result.current.redo(); }); // forward to 'b'
        expect(val).toBe('b');
    });

    it('push after undo discards redo history', () => {
        const { result } = renderHook(() => useUndoRedo<string>());

        act(() => {
            result.current.pushSnapshot('a');
            result.current.pushSnapshot('b');
            result.current.pushSnapshot('c');
        });

        act(() => { result.current.undo(); }); // at 'b'
        act(() => { result.current.pushSnapshot('d'); }); // replaces 'c' forward

        expect(result.current.canRedo()).toBe(false);

        let val: string | null = null;
        act(() => { val = result.current.undo(); });
        expect(val).toBe('b');
    });

    it('trims stack to MAX_UNDO_LEVELS (50)', () => {
        const { result } = renderHook(() => useUndoRedo<number>());

        act(() => {
            for (let i = 0; i < 60; i++) {
                result.current.pushSnapshot(i);
            }
        });

        // Should be able to undo 49 times (50 items, minus 1 for current position)
        let undoCount = 0;
        act(() => {
            while (result.current.canUndo()) {
                result.current.undo();
                undoCount++;
            }
        });
        expect(undoCount).toBe(49);
    });

    it('redo at end returns null', () => {
        const { result } = renderHook(() => useUndoRedo<string>());
        act(() => { result.current.pushSnapshot('a'); });

        let val: string | null = 'not null';
        act(() => { val = result.current.redo(); });
        expect(val).toBeNull();
    });
});
