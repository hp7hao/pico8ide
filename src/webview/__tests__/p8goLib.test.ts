import { describe, expect, it } from 'vitest';
import p8goLib from '../../../resources/libs/p8go.json';

describe('p8go bundled library', () => {
    it('is an opt-in shared library', () => {
        expect(p8goLib.id).toBe('p8go');
        expect(p8goLib.tags).toContain('ipc');
        expect(p8goLib.code).toContain('p8go={}');
        expect(p8goLib.code).toContain('function p8go.ipc_send(ch,msg) _w(1,ch,msg) end');
    });

    it('keeps device helpers layered over basic IPC channels', () => {
        expect(p8goLib.code).toContain('p8go.ipc_send("haptic",chr(1)');
        expect(p8goLib.code).toContain('p8go.ipc_send("haptic",chr(2))');
        expect(p8goLib.code).toContain('p8go.ipc_send("ach",chr(1)..id)');
        expect(p8goLib.code).toContain('p8go.ipc_send("ach",chr(2)..id');
        expect(p8goLib.code).not.toContain('_w(2,"haptic"');
        expect(p8goLib.code).not.toContain('_w(4,"ach"');
    });
});
