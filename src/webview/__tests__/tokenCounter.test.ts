import { describe, it, expect } from 'vitest';
import { countTokens, countChars } from '../../extension/tokenCounter';

describe('countTokens', () => {
    it('counts simple identifiers', () => {
        expect(countTokens('x')).toBe(1);
        expect(countTokens('hello world')).toBe(2);
    });

    it('counts operators as tokens', () => {
        expect(countTokens('a+b')).toBe(3); // a, +, b
        expect(countTokens('a==b')).toBe(3); // a, ==, b
        expect(countTokens('a~=b')).toBe(3);
    });

    it('treats free keywords as 0 tokens', () => {
        // 'end' and 'local' are free
        expect(countTokens('end')).toBe(0);
        expect(countTokens('local')).toBe(0);
        expect(countTokens('local x')).toBe(1); // just x
    });

    it('counts operator keywords as 1 token', () => {
        expect(countTokens('not')).toBe(1);
        expect(countTokens('and')).toBe(1);
        expect(countTokens('or')).toBe(1);
    });

    it('treats delimiters as free', () => {
        expect(countTokens('()')).toBe(0);
        expect(countTokens('{}')).toBe(0);
        expect(countTokens('[]')).toBe(0);
        expect(countTokens(',')).toBe(0);
        expect(countTokens(';')).toBe(0);
    });

    it('treats dot as free but .. as 1 token', () => {
        expect(countTokens('a.b')).toBe(2); // a, b; dot is free
        expect(countTokens('a..b')).toBe(3); // a, .., b
        expect(countTokens('a...b')).toBe(3); // a, ..., b (vararg)
    });

    it('treats colon as free', () => {
        expect(countTokens('a:b')).toBe(2);
    });

    it('counts strings as 1 token', () => {
        expect(countTokens('"hello"')).toBe(1);
        expect(countTokens("'hello'")).toBe(1);
        expect(countTokens('[[hello]]')).toBe(1);
    });

    it('handles escape sequences in strings', () => {
        expect(countTokens('"he\\"llo"')).toBe(1);
    });

    it('counts numbers as 1 token', () => {
        expect(countTokens('42')).toBe(1);
        expect(countTokens('3.14')).toBe(1);
        expect(countTokens('0xff')).toBe(1);
        expect(countTokens('0xFF')).toBe(1);
        expect(countTokens('0b101')).toBe(1);
    });

    it('ignores single-line comments', () => {
        expect(countTokens('x -- this is a comment')).toBe(1);
    });

    it('ignores block comments', () => {
        expect(countTokens('x --[[block comment]] y')).toBe(2);
    });

    it('handles empty code', () => {
        expect(countTokens('')).toBe(0);
    });

    it('handles whitespace only', () => {
        expect(countTokens('   \n\t\r  ')).toBe(0);
    });

    it('counts a realistic PICO-8 snippet', () => {
        const code = `function _init()
  x=64
  y=64
end`;
        // function(1) _init(1) x(1) =(1) 64(1) y(1) =(1) 64(1) end(free) = 8
        expect(countTokens(code)).toBe(8);
    });

    it('counts += as one token', () => {
        expect(countTokens('x+=1')).toBe(3); // x, +=, 1
    });

    it('counts if/then/while as tokens', () => {
        expect(countTokens('if')).toBe(1);
        expect(countTokens('then')).toBe(1);
        expect(countTokens('while')).toBe(1);
    });
});

describe('countChars', () => {
    it('returns string length', () => {
        expect(countChars('hello')).toBe(5);
        expect(countChars('')).toBe(0);
    });

    it('counts whitespace and newlines', () => {
        expect(countChars('a b\nc')).toBe(5);
    });
});
