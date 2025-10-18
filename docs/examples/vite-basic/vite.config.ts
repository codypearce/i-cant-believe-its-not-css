import { defineConfig } from 'vite';
import { icbincssVitePlugin } from 'i-cant-believe-its-not-css';

export default defineConfig({
  plugins: [
    icbincssVitePlugin({
      // Optional: override emitted CSS name on build
      // outFile: 'assets/not.css',
    }),
  ],
});
