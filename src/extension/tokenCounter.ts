// PICO-8 token and character counter
// Ported from cartViewerHtml.legacy.ts to reusable TypeScript module

const FREE_KEYWORDS: Record<string, boolean> = { 'end': true, 'local': true };
const OP_KEYWORDS: Record<string, boolean> = { 'not': true, 'and': true, 'or': true };
const TWO_CHAR_OPS: Record<string, boolean> = {
    '==': true, '~=': true, '<=': true, '>=': true, '..': true,
    '+=': true, '-=': true, '*=': true, '/=': true, '%=': true,
    '^=': true, '!=': true,
};

export function countTokens(code: string): number {
    let tokens = 0;
    let i = 0;
    const len = code.length;

    while (i < len) {
        const ch = code[i];

        // Skip whitespace
        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { i++; continue; }

        // Comments
        if (ch === '-' && i + 1 < len && code[i + 1] === '-') {
            i += 2;
            if (i + 1 < len && code[i] === '[' && code[i + 1] === '[') {
                i += 2;
                while (i + 1 < len && !(code[i] === ']' && code[i + 1] === ']')) i++;
                if (i + 1 < len) i += 2;
            } else {
                while (i < len && code[i] !== '\n') i++;
            }
            continue;
        }

        // Free punctuation (delimiters that don't cost a token)
        if (ch === ',' || ch === ';' || ch === '(' || ch === ')' ||
            ch === '[' || ch === ']' || ch === '{' || ch === '}') {
            i++; continue;
        }

        // Dot: only ".." and "..." cost a token; single "." is free
        if (ch === '.') {
            if (i + 1 < len && code[i + 1] === '.') {
                tokens++;
                i += (i + 2 < len && code[i + 2] === '.') ? 3 : 2;
                continue;
            }
            i++; continue;
        }

        // Colon is free
        if (ch === ':') { i++; continue; }

        // String literals
        if (ch === '"' || ch === "'") {
            tokens++;
            const q = ch;
            i++;
            while (i < len && code[i] !== q) {
                if (code[i] === '\\') i++;
                i++;
            }
            if (i < len) i++;
            continue;
        }

        // Long string [[...]]
        if (ch === '[' && i + 1 < len && code[i + 1] === '[') {
            tokens++;
            i += 2;
            while (i + 1 < len && !(code[i] === ']' && code[i + 1] === ']')) i++;
            if (i + 1 < len) i += 2;
            continue;
        }

        // Numbers
        if ((ch >= '0' && ch <= '9') ||
            (ch === '.' && i + 1 < len && code[i + 1] >= '0' && code[i + 1] <= '9')) {
            tokens++;
            if (ch === '0' && i + 1 < len && (code[i + 1] === 'x' || code[i + 1] === 'X')) {
                i += 2;
                while (i < len && /[0-9a-fA-F_]/.test(code[i])) i++;
                if (i < len && code[i] === '.') { i++; while (i < len && /[0-9a-fA-F_]/.test(code[i])) i++; }
            } else if (ch === '0' && i + 1 < len && (code[i + 1] === 'b' || code[i + 1] === 'B')) {
                i += 2;
                while (i < len && /[01_]/.test(code[i])) i++;
            } else {
                while (i < len && ((code[i] >= '0' && code[i] <= '9') || code[i] === '.')) i++;
            }
            continue;
        }

        // Identifiers and keywords
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
            const start = i;
            while (i < len && ((code[i] >= 'a' && code[i] <= 'z') ||
                (code[i] >= 'A' && code[i] <= 'Z') ||
                (code[i] >= '0' && code[i] <= '9') ||
                code[i] === '_')) i++;
            const word = code.substring(start, i);
            if (FREE_KEYWORDS[word]) continue;
            if (OP_KEYWORDS[word]) { tokens++; continue; }
            tokens++;
            continue;
        }

        // Two-character operators
        if (i + 1 < len && TWO_CHAR_OPS[code[i] + code[i + 1]]) {
            tokens++;
            i += 2;
            continue;
        }

        // Single-character operator (=, +, -, *, /, %, ^, #, <, >, ~, etc.)
        tokens++;
        i++;
    }

    return tokens;
}

export function countChars(code: string): number {
    // PICO-8 counts all characters including whitespace but excluding comments
    // For simplicity (matching legacy behavior), just return code length
    return code.length;
}
