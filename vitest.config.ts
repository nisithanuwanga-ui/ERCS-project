import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['backend/tests/**/*.test.ts','src/**/*.test.ts','src/**/*.test.tsx'],exclude:['e2e/**','node_modules/**']}});
