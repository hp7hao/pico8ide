import { create } from 'zustand';
import { getVscodeApi } from '../vscodeApi';

interface CartState {
    gfx: number[];
    map: number[];
    flags: number[];
    sfx: number[];
    music: number[];
    code: string;
    label: string | null;
    pal: number[][];

    setGfx: (gfx: number[]) => void;
    setMap: (map: number[], gfx?: number[]) => void;
    setFlags: (flags: number[]) => void;
    setSfx: (sfx: number[]) => void;
    setMusic: (music: number[]) => void;
    setCode: (code: string) => void;
}

// Debounce timers for extension host notifications
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncePost(type: string, data: Record<string, any>, delayMs = 100) {
    if (debounceTimers[type]) {
        clearTimeout(debounceTimers[type]);
    }
    debounceTimers[type] = setTimeout(() => {
        getVscodeApi().postMessage({ type, ...data });
    }, delayMs);
}

export const useCartStore = create<CartState>((set) => ({
    gfx: [],
    map: [],
    flags: [],
    sfx: [],
    music: [],
    code: '',
    label: null,
    pal: [],

    setGfx: (gfx) => {
        set({ gfx });
        debouncePost('gfxChanged', { gfx: [...gfx] });
    },
    setMap: (map, gfx) => {
        const update: Partial<CartState> = { map };
        if (gfx) { update.gfx = gfx; }
        set(update);
        const msg: Record<string, any> = { map: [...map] };
        if (gfx) { msg.gfx = [...gfx]; }
        debouncePost('mapChanged', msg);
    },
    setFlags: (flags) => {
        set({ flags });
        debouncePost('flagsChanged', { flags: [...flags] });
    },
    setSfx: (sfx) => {
        set({ sfx });
        debouncePost('sfxChanged', { sfx: [...sfx] });
    },
    setMusic: (music) => {
        set({ music });
        debouncePost('musicChanged', { music: [...music] });
    },
    setCode: (code) => {
        set({ code });
        debouncePost('codeChanged', { code });
    },
}));
