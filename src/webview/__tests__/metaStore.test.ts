import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMetaStore } from '../store/metaStore';
import { bridge } from '../bridge';

describe('metaStore', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
        vi.spyOn(bridge, 'postMessage');
        useMetaStore.setState({
            meta: { title: '', author: '', template: 'default' },
            i18nData: null,
        });
    });

    it('defaults meta fields', () => {
        const state = useMetaStore.getState();
        expect(state.meta.title).toBe('');
        expect(state.meta.author).toBe('');
        expect(state.meta.template).toBe('default');
        expect(state.i18nData).toBeNull();
    });

    it('setMeta replaces the full meta object', () => {
        useMetaStore.getState().setMeta({ title: 'My Game', author: 'Me', template: 'cyan' });
        const state = useMetaStore.getState();
        expect(state.meta.title).toBe('My Game');
        expect(state.meta.author).toBe('Me');
        expect(state.meta.template).toBe('cyan');
    });

    it('setMetaField updates a single field', () => {
        useMetaStore.getState().setMetaField('title', 'Test Title');
        expect(useMetaStore.getState().meta.title).toBe('Test Title');
        expect(useMetaStore.getState().meta.author).toBe('');
    });

    it('notifyMetaChanged sends debounced message via bridge', () => {
        useMetaStore.getState().setMetaField('title', 'Hello');
        // Not yet sent
        expect(bridge.postMessage).not.toHaveBeenCalled();

        vi.advanceTimersByTime(200);

        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'metaChanged',
                metaData: expect.objectContaining({
                    meta: expect.objectContaining({ title: 'Hello' }),
                }),
            })
        );
    });

    it('multiple rapid changes coalesce into one message', () => {
        useMetaStore.getState().setMetaField('title', 'A');
        useMetaStore.getState().setMetaField('title', 'AB');
        useMetaStore.getState().setMetaField('title', 'ABC');

        vi.advanceTimersByTime(200);

        // Only one message sent
        expect(bridge.postMessage).toHaveBeenCalledTimes(1);
        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                metaData: expect.objectContaining({
                    meta: expect.objectContaining({ title: 'ABC' }),
                }),
            })
        );
    });

    it('setI18nData triggers metaChanged message', () => {
        useMetaStore.getState().setI18nData({
            locales: ['en', 'zh_CN'],
            entries: [{ key: 'hello', translations: { en: 'Hello', zh_CN: '你好' } }],
        });

        vi.advanceTimersByTime(200);

        expect(bridge.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'metaChanged',
                metaData: expect.objectContaining({
                    i18n: expect.objectContaining({
                        locales: ['en', 'zh_CN'],
                    }),
                }),
            })
        );
    });
});
