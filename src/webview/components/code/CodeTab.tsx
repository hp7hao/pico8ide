import { useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { useLibStore } from '../../store/libStore';
import { getVscodeApi } from '../../vscodeApi';
import { CodeToolbar } from './CodeToolbar';
import { LibPicker } from './LibPicker';
import type { LocaleStrings } from '../../types';
import { countTokens, countChars } from '../../../extension/tokenCounter';

interface CodeTabProps {
    monacoBaseUri: string;
    editorFontSize: number;
    editorFontFamily: string;
    editorLineHeight: number;
    editorTabSize: number;
    editorInsertSpaces: boolean;
    editorWordWrap: string;
    editorRenderWhitespace: string;
    editorCursorStyle: string;
    editorCursorBlinking: string;
    editorMinimapEnabled: boolean;
    editorBracketPairColorization: boolean;
    editorGuidesBracketPairs: boolean | string;
    editable: boolean;
    locale: LocaleStrings;
}

const MAX_TOKENS = 8192;
const MAX_CHARS = 65535;

interface Pico8ApiItem {
    label: string;
    insertText: string;
    doc: string;
    detail?: string;
}

const PICO8_API: Pico8ApiItem[] = [
    { label: 'cls', insertText: 'cls(${1:col})', doc: 'Clear screen with color.' },
    { label: 'pset', insertText: 'pset(${1:x}, ${2:y}, ${3:col})', doc: 'Set pixel color.' },
    { label: 'pget', insertText: 'pget(${1:x}, ${2:y})', doc: 'Get pixel color.' },
    { label: 'line', insertText: 'line(${1:x0}, ${2:y0}, ${3:x1}, ${4:y1}, ${5:col})', doc: 'Draw a line.' },
    { label: 'rect', insertText: 'rect(${1:x0}, ${2:y0}, ${3:x1}, ${4:y1}, ${5:col})', doc: 'Draw a rectangle outline.' },
    { label: 'rectfill', insertText: 'rectfill(${1:x0}, ${2:y0}, ${3:x1}, ${4:y1}, ${5:col})', doc: 'Draw a filled rectangle.' },
    { label: 'circ', insertText: 'circ(${1:x}, ${2:y}, ${3:r}, ${4:col})', doc: 'Draw a circle outline.' },
    { label: 'circfill', insertText: 'circfill(${1:x}, ${2:y}, ${3:r}, ${4:col})', doc: 'Draw a filled circle.' },
    { label: 'print', insertText: 'print(${1:str}, ${2:x}, ${3:y}, ${4:col})', doc: 'Print a string.' },
    { label: 'spr', insertText: 'spr(${1:n}, ${2:x}, ${3:y}, ${4:w}, ${5:h}, ${6:flip_x}, ${7:flip_y})', doc: 'Draw a sprite.' },
    { label: 'sspr', insertText: 'sspr(${1:sx}, ${2:sy}, ${3:sw}, ${4:sh}, ${5:dx}, ${6:dy}, ${7:dw}, ${8:dh}, ${9:flip_x}, ${10:flip_y})', doc: 'Draw a texture region from the sprite sheet.' },
    { label: 'map', insertText: 'map(${1:cel_x}, ${2:cel_y}, ${3:sx}, ${4:sy}, ${5:cel_w}, ${6:cel_h}, ${7:layer})', doc: 'Draw map cells.' },
    { label: 'camera', insertText: 'camera(${1:x}, ${2:y})', doc: 'Set the camera offset.' },
    { label: 'clip', insertText: 'clip(${1:x}, ${2:y}, ${3:w}, ${4:h})', doc: 'Set the clipping region.' },
    { label: 'pal', insertText: 'pal(${1:c0}, ${2:c1}, ${3:p})', doc: 'Swap colors or reset the palette.' },
    { label: 'palt', insertText: 'palt(${1:col}, ${2:transparent})', doc: 'Set transparency for a color.' },
    { label: 'color', insertText: 'color(${1:col})', doc: 'Set the default draw color.' },
    { label: 'fillp', insertText: 'fillp(${1:pat})', doc: 'Set the fill pattern.' },
    { label: 'flip', insertText: 'flip()', doc: 'Flip the screen buffer.' },
    { label: 'btn', insertText: 'btn(${1:i}, ${2:p})', doc: 'Read button state. Buttons 0..5 are left, right, up, down, O, X.' },
    { label: 'btnp', insertText: 'btnp(${1:i}, ${2:p})', doc: 'Read whether a button was pressed this frame.' },
    { label: 'rnd', insertText: 'rnd(${1:x})', doc: 'Random number from 0 up to x, exclusive.' },
    { label: 'flr', insertText: 'flr(${1:x})', doc: 'Floor.' },
    { label: 'ceil', insertText: 'ceil(${1:x})', doc: 'Ceiling.' },
    { label: 'abs', insertText: 'abs(${1:x})', doc: 'Absolute value.' },
    { label: 'sgn', insertText: 'sgn(${1:x})', doc: 'Sign, returning -1 or 1.' },
    { label: 'sqrt', insertText: 'sqrt(${1:x})', doc: 'Square root.' },
    { label: 'sin', insertText: 'sin(${1:x})', doc: 'Sine, where 1.0 is a full turn.' },
    { label: 'cos', insertText: 'cos(${1:x})', doc: 'Cosine, where 1.0 is a full turn.' },
    { label: 'atan2', insertText: 'atan2(${1:dx}, ${2:dy})', doc: 'Arctangent, where 1.0 is a full turn.' },
    { label: 'max', insertText: 'max(${1:x}, ${2:y})', doc: 'Maximum.' },
    { label: 'min', insertText: 'min(${1:x}, ${2:y})', doc: 'Minimum.' },
    { label: 'mid', insertText: 'mid(${1:x}, ${2:y}, ${3:z})', doc: 'Middle value.' },
    { label: 'band', insertText: 'band(${1:x}, ${2:y})', doc: 'Bitwise AND.' },
    { label: 'bor', insertText: 'bor(${1:x}, ${2:y})', doc: 'Bitwise OR.' },
    { label: 'bxor', insertText: 'bxor(${1:x}, ${2:y})', doc: 'Bitwise XOR.' },
    { label: 'bnot', insertText: 'bnot(${1:x})', doc: 'Bitwise NOT.' },
    { label: 'shl', insertText: 'shl(${1:x}, ${2:n})', doc: 'Shift left.' },
    { label: 'shr', insertText: 'shr(${1:x}, ${2:n})', doc: 'Arithmetic shift right.' },
    { label: 'lshr', insertText: 'lshr(${1:x}, ${2:n})', doc: 'Logical shift right.' },
    { label: 'rotl', insertText: 'rotl(${1:x}, ${2:n})', doc: 'Rotate left.' },
    { label: 'rotr', insertText: 'rotr(${1:x}, ${2:n})', doc: 'Rotate right.' },
    { label: 'peek', insertText: 'peek(${1:addr})', doc: 'Read a byte from memory.' },
    { label: 'poke', insertText: 'poke(${1:addr}, ${2:val})', doc: 'Write a byte to memory.' },
    { label: 'peek2', insertText: 'peek2(${1:addr})', doc: 'Read a 16-bit value from memory.' },
    { label: 'poke2', insertText: 'poke2(${1:addr}, ${2:val})', doc: 'Write a 16-bit value to memory.' },
    { label: 'peek4', insertText: 'peek4(${1:addr})', doc: 'Read a 32-bit fixed-point value from memory.' },
    { label: 'poke4', insertText: 'poke4(${1:addr}, ${2:val})', doc: 'Write a 32-bit fixed-point value to memory.' },
    { label: 'memcpy', insertText: 'memcpy(${1:dest}, ${2:src}, ${3:len})', doc: 'Copy memory.' },
    { label: 'memset', insertText: 'memset(${1:dest}, ${2:val}, ${3:len})', doc: 'Set memory.' },
    { label: 'fget', insertText: 'fget(${1:n}, ${2:f})', doc: 'Get a sprite flag.' },
    { label: 'fset', insertText: 'fset(${1:n}, ${2:f}, ${3:v})', doc: 'Set a sprite flag.' },
    { label: 'mget', insertText: 'mget(${1:x}, ${2:y})', doc: 'Get a map tile.' },
    { label: 'mset', insertText: 'mset(${1:x}, ${2:y}, ${3:v})', doc: 'Set a map tile.' },
    { label: 'sfx', insertText: 'sfx(${1:n}, ${2:ch}, ${3:off}, ${4:len})', doc: 'Play a sound effect.' },
    { label: 'music', insertText: 'music(${1:n}, ${2:fade}, ${3:mask})', doc: 'Play a music pattern.' },
    { label: 'tostr', insertText: 'tostr(${1:val}, ${2:hex})', doc: 'Convert a value to a string.' },
    { label: 'tonum', insertText: 'tonum(${1:str})', doc: 'Convert a string to a number.' },
    { label: 'chr', insertText: 'chr(${1:n})', doc: 'Create a character from an ordinal.' },
    { label: 'ord', insertText: 'ord(${1:str}, ${2:i})', doc: 'Get a character ordinal.' },
    { label: 'sub', insertText: 'sub(${1:str}, ${2:i}, ${3:j})', doc: 'Substring.' },
    { label: 'split', insertText: 'split(${1:str}, ${2:sep}, ${3:convert})', doc: 'Split a string into a table.' },
    { label: 'add', insertText: 'add(${1:tbl}, ${2:val}, ${3:i})', doc: 'Add a value to a table.' },
    { label: 'del', insertText: 'del(${1:tbl}, ${2:val})', doc: 'Delete the first matching value from a table.' },
    { label: 'deli', insertText: 'deli(${1:tbl}, ${2:i})', doc: 'Delete a table value by index.' },
    { label: 'count', insertText: 'count(${1:tbl}, ${2:val})', doc: 'Count matching values in a table.' },
    { label: 'all', insertText: 'all(${1:tbl})', doc: 'Iterator for table values.' },
    { label: 'foreach', insertText: 'foreach(${1:tbl}, ${2:func})', doc: 'Call a function for each table value.' },
    { label: 'pairs', insertText: 'pairs(${1:tbl})', doc: 'Iterator for key-value pairs.' },
    { label: 'stat', insertText: 'stat(${1:x})', doc: 'Get system status.' },
    { label: 'menuitem', insertText: 'menuitem(${1:i}, ${2:label}, ${3:callback})', doc: 'Add a pause menu item.' },
    { label: 'time', insertText: 'time()', doc: 'Seconds since program start.' },
    { label: 't', insertText: 't()', doc: 'Alias for time().' },
    { label: 'cocreate', insertText: 'cocreate(${1:func})', doc: 'Create a coroutine.' },
    { label: 'coresume', insertText: 'coresume(${1:cor})', doc: 'Resume a coroutine.' },
    { label: 'costatus', insertText: 'costatus(${1:cor})', doc: 'Get coroutine status.' },
    { label: 'yield', insertText: 'yield()', doc: 'Yield from a coroutine.' },
    { label: '_init', insertText: 'function _init()\n ${1}\nend', doc: 'Called once at cart startup.' },
    { label: '_update', insertText: 'function _update()\n ${1}\nend', doc: 'Called once per frame at 30 FPS.' },
    { label: '_update60', insertText: 'function _update60()\n ${1}\nend', doc: 'Called once per frame at 60 FPS.' },
    { label: '_draw', insertText: 'function _draw()\n ${1}\nend', doc: 'Called once per frame for drawing.' },
];

const PICO8_API_BY_LABEL = new Map(PICO8_API.map((item) => [item.label, item]));

export function CodeTab({
    monacoBaseUri,
    editorFontSize,
    editorFontFamily,
    editorLineHeight,
    editorTabSize,
    editorInsertSpaces,
    editorWordWrap,
    editorRenderWhitespace,
    editorCursorStyle,
    editorCursorBlinking,
    editorMinimapEnabled,
    editorBracketPairColorization,
    editorGuidesBracketPairs,
    editable,
    locale,
}: CodeTabProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const isRestoringRef = useRef(false);
    const code = useCartStore((s) => s.code);
    const setCode = useCartStore((s) => s.setCode);
    const activeTab = useUIStore((s) => s.activeTab);
    const libPanelOpen = useLibStore((s) => s.libPanelOpen);

    // Layout Monaco when tab becomes active
    useEffect(() => {
        if (activeTab === 'code' && editorRef.current) {
            editorRef.current.layout();
        }
    }, [activeTab]);

    // Initialize Monaco
    useEffect(() => {
        if (!containerRef.current) return;

        const script = document.createElement('script');
        script.src = `${monacoBaseUri}/loader.js`;
        script.onerror = () => {
            console.error('Failed to load Monaco loader.js from:', monacoBaseUri);
        };
        script.onload = () => {
            const _require = (window as any).require;
            _require.config({
                paths: { vs: monacoBaseUri },
            });

            // Worker workaround for webview — must use blob: URL to preserve origin
            // (data: URLs get null origin and can't importScripts from vscode-resource)
            (window as any).MonacoEnvironment = {
                getWorkerUrl: function () {
                    const js = 'self.MonacoEnvironment={baseUrl:"' + monacoBaseUri + '/"};importScripts("' + monacoBaseUri + '/base/worker/workerMain.js");';
                    const blob = new Blob([js], { type: 'application/javascript' });
                    return URL.createObjectURL(blob);
                },
            };

            _require(['vs/editor/editor.main'], (monaco: any) => {
                // Register PICO-8 Lua language
                monaco.languages.register({ id: 'pico8-lua' });
                monaco.languages.setMonarchTokensProvider('pico8-lua', getPico8LuaTokenizer());
                registerPico8CompletionProvider(monaco);
                registerPico8HoverProvider(monaco);

                // Register PICO-8 dark theme
                monaco.editor.defineTheme('pico8-dark', getPico8DarkTheme());

                // Get latest code from store (not from closure — script loading is async)
                const currentCode = useCartStore.getState().code;
                console.log('[pico8ide] Monaco creating editor, code length:', currentCode?.length, 'first 100 chars:', currentCode?.substring(0, 100));
                console.log('[pico8ide] Monaco container dims:', containerRef.current?.clientWidth, 'x', containerRef.current?.clientHeight);

                const editor = monaco.editor.create(containerRef.current, {
                    value: currentCode,
                    language: 'pico8-lua',
                    theme: 'pico8-dark',
                    readOnly: !editable,
                    fontSize: editorFontSize,
                    fontFamily: editorFontFamily,
                    lineHeight: editorLineHeight || 0,
                    minimap: { enabled: editorMinimapEnabled },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: normalizeWordWrap(editorWordWrap),
                    tabSize: editorTabSize,
                    insertSpaces: editorInsertSpaces,
                    renderWhitespace: normalizeRenderWhitespace(editorRenderWhitespace),
                    cursorStyle: normalizeCursorStyle(editorCursorStyle),
                    cursorBlinking: normalizeCursorBlinking(editorCursorBlinking),
                    bracketPairColorization: { enabled: editorBracketPairColorization },
                    guides: { bracketPairs: editorGuidesBracketPairs as any },
                    folding: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                    stickyScroll: { enabled: false },
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true,
                });

                editorRef.current = editor;

                // Force layout after a short delay to ensure container has dimensions
                setTimeout(() => {
                    editor.layout();
                }, 100);

                if (editable) {
                    editor.onDidChangeModelContent(() => {
                        if (isRestoringRef.current) return;
                        setCode(editor.getValue());
                        updatePico8Markers(monaco, editor.getModel());
                    });
                }
                updatePico8Markers(monaco, editor.getModel());

                // Signal to extension host that Monaco is ready and any initial
                // change events have already fired. The extension uses this to
                // start tracking dirty state.
                getVscodeApi().postMessage({ type: 'ready' });
            });
        };
        document.head.appendChild(script);

        return () => {
            if (editorRef.current) {
                editorRef.current.dispose();
                editorRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync Monaco editor when code changes via silent restore (undo/redo)
    useEffect(() => {
        const unsub = useCartStore.subscribe((state, prevState) => {
            if (state.code !== prevState.code && editorRef.current) {
                const editorValue = editorRef.current.getValue();
                if (editorValue !== state.code) {
                    isRestoringRef.current = true;
                    replaceEditorValue(editorRef.current, state.code);
                    isRestoringRef.current = false;
                }
            }
        });
        return unsub;
    }, []);

    return (
        <>
            <CodeToolbar locale={locale} editable={editable} />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <div
                    id="monaco-container"
                    ref={containerRef}
                    style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
                />
                {editable && libPanelOpen && (
                    <LibPicker locale={locale} />
                )}
            </div>
        </>
    );
}

function getPico8LuaTokenizer() {
    return {
        defaultToken: '',
        keywords: [
            'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
            'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or',
            'repeat', 'return', 'then', 'true', 'until', 'while',
        ],
        builtins: [
            'print', 'cls', 'spr', 'sspr', 'map', 'mget', 'mset', 'fget', 'fset',
            'pget', 'pset', 'rectfill', 'rect', 'circfill', 'circ', 'line', 'pal',
            'palt', 'fillp', 'clip', 'camera', 'color', 'cursor', 'btnp', 'btn',
            'sfx', 'music', 'stat', 'rnd', 'flr', 'ceil', 'cos', 'sin', 'atan2',
            'sqrt', 'abs', 'sgn', 'max', 'min', 'mid', 'band', 'bor', 'bxor',
            'bnot', 'shl', 'shr', 'lshr', 'rotl', 'rotr', 'peek', 'poke',
            'peek2', 'poke2', 'peek4', 'poke4', 'memcpy', 'memset', 'reload',
            'cstore', 'cartdata', 'dget', 'dset', 'printh', 'tostr', 'tonum',
            'type', 'sub', 'chr', 'ord', 'split', 'add', 'del', 'deli', 'count',
            'all', 'foreach', 'pairs', 'cocreate', 'coresume', 'costatus',
            'yield', 'assert', 'select', 'pack', 'unpack', 'menuitem', 'extcmd',
            'serial', 'run', 'stop', 'resume', 'reboot', 'reset', 'flip',
            '_init', '_update', '_update60', '_draw',
        ],
        tokenizer: {
            root: [
                [/--\[\[[\s\S]*?\]\]/, 'comment'],
                [/--.*$/, 'comment'],
                [/"[^"]*"/, 'string'],
                [/'[^']*'/, 'string'],
                [/\[\[[\s\S]*?\]\]/, 'string'],
                [/0[xX][0-9a-fA-F]+(\.[0-9a-fA-F]*)?/, 'number'],
                [/0[bB][01]+/, 'number'],
                [/\d+(\.\d+)?/, 'number'],
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@builtins': 'builtin',
                        '@default': 'identifier',
                    },
                }],
                [/[+\-*/%^#=<>~]|\.\./, 'operator'],
                [/[{}()\[\]]/, 'delimiter'],
            ],
        },
    };
}

function registerPico8CompletionProvider(monaco: any) {
    monaco.languages.registerCompletionItemProvider('pico8-lua', {
        triggerCharacters: ['.', '#', '_'],
        provideCompletionItems(model: any, position: any) {
            const text = model.getValue();
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };
            const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);

            if (/^\s*--#include\s+\S*$/.test(linePrefix)) {
                return {
                    suggestions: [
                        {
                            label: 'p8go',
                            kind: monaco.languages.CompletionItemKind.Module,
                            detail: 'PICO8GO device bridge runtime',
                            documentation: 'Opt-in PICO8GO mailbox IPC runtime. Resolves during run/export from resources/libs/p8go.json.',
                            insertText: 'p8go',
                            range,
                        },
                    ],
                };
            }

            if (!/\.\w*$/.test(linePrefix)) {
                const suggestions = PICO8_API.map((item) => ({
                    label: item.label,
                    kind: item.label.startsWith('_')
                        ? monaco.languages.CompletionItemKind.Event
                        : monaco.languages.CompletionItemKind.Function,
                    detail: item.detail || item.insertText.replace(/\$\{\d+:([^}]+)\}/g, '$1'),
                    documentation: item.doc,
                    insertText: item.insertText,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range,
                }));
                return { suggestions };
            }

            if (!/^\s*p8go\.\w*$/.test(linePrefix)) {
                return { suggestions: [] };
            }
            if (!/^--#include\s+p8go\s*$/m.test(text)) {
                return { suggestions: [] };
            }

            const mk = (label: string, insertText: string, detail: string, documentation: string) => ({
                label,
                kind: monaco.languages.CompletionItemKind.Function,
                detail,
                documentation,
                insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
            });

            return {
                suggestions: [
                    mk('ipc_send', 'ipc_send(${1:channel},${2:payload})', 'p8go.ipc_send(channel,payload)', 'Send one small cart-to-host IPC message on a channel.'),
                    mk('has', 'has(${1:capability})', 'p8go.has(capability)', 'Check whether the p8go runtime marker is active.'),
                    mk('vibe', 'vibe(${1:ms},${2:strength})', 'p8go.vibe(ms,strength)', 'Haptic package helper over the haptic IPC channel.'),
                    mk('vibe_stop', 'vibe_stop()', 'p8go.vibe_stop()', 'Stop haptic output through the haptic IPC channel.'),
                    mk('ach_unlock', 'ach_unlock(${1:id})', 'p8go.ach_unlock(id)', 'Achievement package helper over the ach IPC channel.'),
                    mk('ach_progress', 'ach_progress(${1:id},${2:value},${3:target})', 'p8go.ach_progress(id,value,target)', 'Achievement progress helper over the ach IPC channel.'),
                ],
            };
        },
    });
}

function registerPico8HoverProvider(monaco: any) {
    monaco.languages.registerHoverProvider('pico8-lua', {
        provideHover(model: any, position: any) {
            const word = model.getWordAtPosition(position);
            if (!word) return null;
            const item = PICO8_API_BY_LABEL.get(word.word);
            if (!item) return null;
            return {
                range: new monaco.Range(
                    position.lineNumber,
                    word.startColumn,
                    position.lineNumber,
                    word.endColumn
                ),
                contents: [
                    { value: `\`${item.insertText.replace(/\$\{\d+:([^}]+)\}/g, '$1')}\`` },
                    { value: item.doc },
                ],
            };
        },
    });
}

function getPico8DarkTheme() {
    return {
        base: 'vs-dark' as const,
        inherit: true,
        rules: [
            { token: 'keyword', foreground: 'ff77a8' },
            { token: 'builtin', foreground: '29adff' },
            { token: 'string', foreground: '00e436' },
            { token: 'comment', foreground: '5f574f', fontStyle: 'italic' },
            { token: 'number', foreground: 'ffec27' },
            { token: 'operator', foreground: 'ff77a8' },
            { token: 'identifier', foreground: 'c2c3c7' },
            { token: 'delimiter', foreground: 'c2c3c7' },
        ],
        colors: {
            'editor.background': '#1a1a1a',
            'editor.foreground': '#c2c3c7',
            'editorLineNumber.foreground': '#555555',
            'editorCursor.foreground': '#ff77a8',
            'editor.selectionBackground': '#3a3a5a',
            'editor.lineHighlightBackground': '#222222',
            'editorIndentGuide.background': '#333333',
            'editorWidget.background': '#1a1a1a',
            'editorWidget.border': '#333333',
            'input.background': '#252525',
            'input.foreground': '#c2c3c7',
            'input.border': '#333333',
            'focusBorder': '#ff77a8',
            'scrollbarSlider.background': '#333333aa',
            'scrollbarSlider.hoverBackground': '#444444aa',
        },
    };
}

function normalizeWordWrap(value: string) {
    if (['off', 'on', 'wordWrapColumn', 'bounded'].includes(value)) return value;
    return 'off';
}

function normalizeRenderWhitespace(value: string) {
    if (['none', 'boundary', 'selection', 'trailing', 'all'].includes(value)) return value;
    return 'selection';
}

function normalizeCursorStyle(value: string) {
    if (['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'].includes(value)) return value;
    return 'line';
}

function normalizeCursorBlinking(value: string) {
    if (['blink', 'smooth', 'phase', 'expand', 'solid'].includes(value)) return value;
    return 'blink';
}

function replaceEditorValue(editor: any, nextValue: string) {
    const model = editor.getModel();
    if (!model) {
        editor.setValue(nextValue);
        return;
    }
    const selection = editor.getSelection();
    const scrollTop = editor.getScrollTop();
    const scrollLeft = editor.getScrollLeft();
    const fullRange = model.getFullModelRange();
    editor.pushUndoStop();
    editor.executeEdits('pico8ide.restore', [{ range: fullRange, text: nextValue }]);
    editor.pushUndoStop();
    if (selection) editor.setSelection(selection);
    editor.setScrollPosition({ scrollTop, scrollLeft });
}

function updatePico8Markers(monaco: any, model: any) {
    if (!model) return;
    const code = model.getValue();
    const tokens = countTokens(code);
    const chars = countChars(code);
    const markers: any[] = [];

    const pushLimitMarker = (message: string) => {
        const line = model.getLineCount();
        const column = Math.max(1, model.getLineMaxColumn(line) - 1);
        markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: model.getLineMaxColumn(line),
        });
    };

    if (tokens > MAX_TOKENS) {
        pushLimitMarker(`PICO-8 token limit exceeded: ${tokens}/${MAX_TOKENS}`);
    } else if (tokens >= MAX_TOKENS * 0.95) {
        pushLimitMarker(`PICO-8 token budget is nearly full: ${tokens}/${MAX_TOKENS}`);
    }

    if (chars > MAX_CHARS) {
        pushLimitMarker(`PICO-8 character limit exceeded: ${chars}/${MAX_CHARS}`);
    } else if (chars >= MAX_CHARS * 0.95) {
        pushLimitMarker(`PICO-8 character budget is nearly full: ${chars}/${MAX_CHARS}`);
    }

    monaco.editor.setModelMarkers(model, 'pico8ide', markers);
}
