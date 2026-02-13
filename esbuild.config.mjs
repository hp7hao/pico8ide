import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: ['src/webview/index.tsx'],
    bundle: true,
    outfile: 'out/webview/bundle.js',
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.css': 'css',
    },
    minify: !isWatch,
    sourcemap: isWatch ? 'inline' : false,
    // Don't externalize anything — bundle everything for the webview
    // Monaco is loaded separately via AMD, not bundled
    define: {
        'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    },
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching webview for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('Webview bundle built.');
}
