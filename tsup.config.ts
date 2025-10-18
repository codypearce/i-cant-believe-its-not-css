import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'integrations/vite': 'src/integrations/vite.ts',
    'integrations/nextjs': 'src/integrations/nextjs.ts',
    'cli/index': 'src/cli/index.ts',
    'parser/index': 'src/parser/index.ts',
    'compiler/index': 'src/compiler/index.ts',
    'db/store': 'src/db/store.ts',
    'db/schema': 'src/db/schema.ts',
    'migrate/engine': 'src/migrate/engine.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  shims: true,
  outDir: 'dist',
  external: [
    'chalk',
    'chokidar',
    'commander',
    'fs-extra',
    'peggy',
  ],
  // Keep CLI executable
  onSuccess: 'chmod +x dist/cli/index.js || true',
});
