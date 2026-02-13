import { useCallback, useRef } from 'react';

interface UndoState<T> {
    stack: T[];
    index: number;
}

const MAX_UNDO_LEVELS = 50;

/**
 * Generic undo/redo hook.
 * T is the snapshot type (e.g., number[] for GFX data).
 */
export function useUndoRedo<T>() {
    const stateRef = useRef<UndoState<T>>({ stack: [], index: -1 });

    const pushSnapshot = useCallback((snapshot: T) => {
        const state = stateRef.current;
        // Remove anything after current index (discard redo history)
        state.stack = state.stack.slice(0, state.index + 1);
        state.stack.push(snapshot);
        // Trim to max levels
        if (state.stack.length > MAX_UNDO_LEVELS) {
            state.stack.shift();
        }
        state.index = state.stack.length - 1;
    }, []);

    const undo = useCallback((): T | null => {
        const state = stateRef.current;
        if (state.index <= 0) return null;
        state.index--;
        return state.stack[state.index];
    }, []);

    const redo = useCallback((): T | null => {
        const state = stateRef.current;
        if (state.index >= state.stack.length - 1) return null;
        state.index++;
        return state.stack[state.index];
    }, []);

    const canUndo = useCallback(() => stateRef.current.index > 0, []);
    const canRedo = useCallback(() => stateRef.current.index < stateRef.current.stack.length - 1, []);

    return { pushSnapshot, undo, redo, canUndo, canRedo };
}
