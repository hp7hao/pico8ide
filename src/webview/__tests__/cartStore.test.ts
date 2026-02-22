import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCartStore } from '../store/cartStore';
import { bridge } from '../bridge';

describe('cartStore', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
        vi.spyOn(bridge, 'postMessage');
        useCartStore.setState({
            gfx: new Array(8192).fill(0),
            map: new Array(4096).fill(0),
            flags: new Array(256).fill(0),
            sfx: new Array(4352).fill(0),
            music: new Array(256).fill(0),
            code: '',
            label: null,
            pal: [],
        });
    });

    it('setGfx updates store and posts gfxChanged', () => {
        const newGfx = new Array(8192).fill(1);
        useCartStore.getState().setGfx(newGfx);
        expect(useCartStore.getState().gfx).toEqual(newGfx);

        vi.advanceTimersByTime(200);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'gfxChanged' })
        );
    });

    it('setCode updates store and posts codeChanged', () => {
        useCartStore.getState().setCode('print("hello")');
        expect(useCartStore.getState().code).toBe('print("hello")');

        vi.advanceTimersByTime(200);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'codeChanged', code: 'print("hello")' })
        );
    });

    it('setMap updates map and optionally gfx', () => {
        const newMap = new Array(4096).fill(5);
        const newGfx = new Array(8192).fill(2);
        useCartStore.getState().setMap(newMap, newGfx);

        expect(useCartStore.getState().map).toEqual(newMap);
        expect(useCartStore.getState().gfx).toEqual(newGfx);

        vi.advanceTimersByTime(200);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'mapChanged' })
        );
    });

    it('setMap without gfx only updates map', () => {
        const origGfx = useCartStore.getState().gfx;
        const newMap = new Array(4096).fill(3);
        useCartStore.getState().setMap(newMap);

        expect(useCartStore.getState().map).toEqual(newMap);
        expect(useCartStore.getState().gfx).toEqual(origGfx);
    });

    it('setFlags updates flags and posts flagsChanged', () => {
        const newFlags = new Array(256).fill(0xFF);
        useCartStore.getState().setFlags(newFlags);
        expect(useCartStore.getState().flags).toEqual(newFlags);

        vi.advanceTimersByTime(200);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'flagsChanged' })
        );
    });

    it('setSfx updates sfx and posts sfxChanged', () => {
        const newSfx = new Array(4352).fill(42);
        useCartStore.getState().setSfx(newSfx);
        expect(useCartStore.getState().sfx).toEqual(newSfx);

        vi.advanceTimersByTime(200);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'sfxChanged' })
        );
    });

    it('setMusic updates music and posts musicChanged', () => {
        const newMusic = new Array(256).fill(0x40);
        useCartStore.getState().setMusic(newMusic);
        expect(useCartStore.getState().music).toEqual(newMusic);

        vi.advanceTimersByTime(200);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'musicChanged' })
        );
    });

    it('debounce coalesces rapid updates', () => {
        useCartStore.getState().setCode('a');
        useCartStore.getState().setCode('ab');
        useCartStore.getState().setCode('abc');

        vi.advanceTimersByTime(200);

        // Only one codeChanged message with the last value
        const calls = (bridge.postMessage as any).mock.calls
            .filter((c: any[]) => c[0].type === 'codeChanged');
        expect(calls).toHaveLength(1);
        expect(calls[0][0].code).toBe('abc');
    });
});
