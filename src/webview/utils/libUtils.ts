const INCLUDE_RE = /^--#include\s+(\S+)\s*$/;

export function parseIncludes(code: string): string[] {
    const ids: string[] = [];
    for (const line of code.split('\n')) {
        const m = line.match(INCLUDE_RE);
        if (m) {
            ids.push(m[1]);
        }
    }
    return ids;
}

export function insertInclude(code: string, libId: string): string {
    const directive = `--#include ${libId}`;
    // Check if already present
    if (parseIncludes(code).includes(libId)) {
        return code;
    }
    // Insert at the top of the code
    return directive + '\n' + code;
}

export function removeInclude(code: string, libId: string): string {
    const re = new RegExp(`^--#include\\s+${escapeRegExp(libId)}\\s*$`, 'm');
    const result = code.replace(re, '');
    // Clean up extra blank line left behind
    return result.replace(/^\n/, '');
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
