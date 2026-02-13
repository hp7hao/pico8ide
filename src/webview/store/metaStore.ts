import { create } from 'zustand';
import { getVscodeApi } from '../vscodeApi';
import type { MetaData, I18nData } from '../types';

interface MetaState {
    meta: { title: string; author: string; template: string };
    i18nData: I18nData | null;

    setMeta: (meta: { title: string; author: string; template: string }) => void;
    setMetaField: (field: 'title' | 'author' | 'template', value: string) => void;
    setI18nData: (data: I18nData | null) => void;
    notifyMetaChanged: () => void;
}

let metaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useMetaStore = create<MetaState>((set, get) => ({
    meta: { title: '', author: '', template: 'default' },
    i18nData: null,

    setMeta: (meta) => {
        set({ meta });
        get().notifyMetaChanged();
    },
    setMetaField: (field, value) => {
        set((state) => ({
            meta: { ...state.meta, [field]: value },
        }));
        get().notifyMetaChanged();
    },
    setI18nData: (data) => {
        set({ i18nData: data });
        get().notifyMetaChanged();
    },
    notifyMetaChanged: () => {
        if (metaDebounceTimer) clearTimeout(metaDebounceTimer);
        metaDebounceTimer = setTimeout(() => {
            const state = get();
            const metaData: MetaData = {
                meta: state.meta,
                i18n: state.i18nData,
            };
            getVscodeApi().postMessage({ type: 'metaChanged', metaData });
        }, 100);
    },
}));
