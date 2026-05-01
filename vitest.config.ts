import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
        environment: 'node',
        setupFiles: ['src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            include: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
            exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
        },
    },
});
