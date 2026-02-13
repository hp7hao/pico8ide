import { useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import type { LocaleStrings } from '../../types';

interface CodeTabProps {
    monacoBaseUri: string;
    editorFontSize: number;
    editorFontFamily: string;
    editorLineHeight: number;
    editable: boolean;
    locale: LocaleStrings;
}

export function CodeTab({ monacoBaseUri, editorFontSize, editorFontFamily, editorLineHeight, editable, locale }: CodeTabProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const code = useCartStore((s) => s.code);
    const setCode = useCartStore((s) => s.setCode);
    const activeTab = useUIStore((s) => s.activeTab);

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
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'off',
                    tabSize: 1,
                    insertSpaces: true,
                });

                editorRef.current = editor;

                // Force layout after a short delay to ensure container has dimensions
                setTimeout(() => {
                    editor.layout();
                }, 100);

                if (editable) {
                    editor.onDidChangeModelContent(() => {
                        setCode(editor.getValue());
                    });
                }
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

    return (
        <div
            id="monaco-container"
            ref={containerRef}
            style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
        />
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
            'editorCursor.foreground': '#ff77a8',
        },
    };
}
