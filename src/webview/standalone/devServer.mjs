import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

const ctx = await esbuild.context({
    entryPoints: [path.resolve(__dirname, 'index.tsx')],
    bundle: true,
    outfile: path.join(projectRoot, 'out/standalone/bundle.js'),
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.css': 'css',
    },
    sourcemap: 'inline',
    define: {
        'process.env.NODE_ENV': '"development"',
        '__HOST_MODE__': '"standalone"',
    },
});

await ctx.watch();

const { host, port } = await ctx.serve({
    servedir: projectRoot,
    fallback: path.resolve(__dirname, 'index.html'),
});

console.log(`Standalone dev server running at http://localhost:${port}/src/webview/standalone/index.html`);
console.log('Watching for changes...');
console.log('Press Ctrl+C to stop.');
