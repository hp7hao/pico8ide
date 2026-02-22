import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        setupFiles: ['src/webview/__tests__/setup.ts'],
        include: ['src/webview/__tests__/**/*.test.{ts,tsx}'],
    },
    define: {
        '__HOST_MODE__': '"standalone"',
    },
});
