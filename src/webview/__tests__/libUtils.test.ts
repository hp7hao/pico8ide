import { describe, it, expect } from 'vitest';
import { parseIncludes, insertInclude, removeInclude } from '../utils/libUtils';

describe('parseIncludes', () => {
    it('parses --#include directives', () => {
        const code = '--#include vec2\n--#include easing\nfunction _init()\nend';
        expect(parseIncludes(code)).toEqual(['vec2', 'easing']);
    });

    it('returns empty array when no includes', () => {
        expect(parseIncludes('function _init()\nend')).toEqual([]);
    });

    it('ignores malformed includes', () => {
        const code = '-- #include nope\n--#include yes';
        expect(parseIncludes(code)).toEqual(['yes']);
    });

    it('handles empty code', () => {
        expect(parseIncludes('')).toEqual([]);
    });

    it('handles include with extra whitespace', () => {
        const code = '--#include  vec2  \nsome code';
        // Only first word after --#include is captured
        expect(parseIncludes(code)).toEqual(['vec2']);
    });
});

describe('insertInclude', () => {
    it('inserts at top of code', () => {
        const code = 'function _init()\nend';
        const result = insertInclude(code, 'vec2');
        expect(result).toBe('--#include vec2\nfunction _init()\nend');
    });

    it('does not duplicate existing include', () => {
        const code = '--#include vec2\nfunction _init()\nend';
        const result = insertInclude(code, 'vec2');
        expect(result).toBe(code);
    });

    it('adds second include before code', () => {
        const code = '--#include vec2\nfunction _init()\nend';
        const result = insertInclude(code, 'easing');
        expect(result).toBe('--#include easing\n--#include vec2\nfunction _init()\nend');
    });
});

describe('removeInclude', () => {
    it('removes an existing include', () => {
        const code = '--#include vec2\nfunction _init()\nend';
        const result = removeInclude(code, 'vec2');
        expect(result).toBe('function _init()\nend');
    });

    it('does nothing when include not found', () => {
        const code = 'function _init()\nend';
        const result = removeInclude(code, 'vec2');
        expect(result).toBe(code);
    });

    it('removes only the specified include', () => {
        const code = '--#include vec2\n--#include easing\nfunction _init()\nend';
        const result = removeInclude(code, 'vec2');
        expect(result).toBe('--#include easing\nfunction _init()\nend');
    });

    it('handles special regex characters in lib id', () => {
        const code = '--#include my.lib\ncode';
        const result = removeInclude(code, 'my.lib');
        expect(result).toBe('code');
    });
});
