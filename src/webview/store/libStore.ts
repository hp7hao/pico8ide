import { create } from 'zustand';
import type { Pico8LibMeta } from '../types';

interface LibState {
    availableLibs: Pico8LibMeta[];
    searchQuery: string;
    libPanelOpen: boolean;
    setAvailableLibs: (libs: Pico8LibMeta[]) => void;
    setSearchQuery: (q: string) => void;
    setLibPanelOpen: (open: boolean) => void;
    toggleLibPanel: () => void;
}

export const useLibStore = create<LibState>((set) => ({
    availableLibs: [],
    searchQuery: '',
    libPanelOpen: false,
    setAvailableLibs: (libs) => set({ availableLibs: libs }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setLibPanelOpen: (open) => set({ libPanelOpen: open }),
    toggleLibPanel: () => set((s) => ({ libPanelOpen: !s.libPanelOpen })),
}));
