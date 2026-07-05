import * as esbuild from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Fixed-port standalone server for Playwright (Tier B). Mirrors dev:standalone
// but binds a deterministic port so playwright.config.ts can point at it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PW_PORT || 5599);

const ctx = await esbuild.context({
    entryPoints: [path.join(projectRoot, 'src/webview/standalone/index.tsx')],
    bundle: true,
    outfile: path.join(projectRoot, 'out/standalone/bundle.js'),
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
    sourcemap: 'inline',
    define: {
        'process.env.NODE_ENV': '"development"',
        '__HOST_MODE__': '"standalone"',
    },
});

await ctx.rebuild();
await ctx.serve({
    servedir: projectRoot,
    host: '127.0.0.1',
    port: PORT,
    fallback: path.join(projectRoot, 'src/webview/standalone/index.html'),
});

console.log(`[pw-server] standalone serving at http://127.0.0.1:${PORT}/src/webview/standalone/index.html`);
