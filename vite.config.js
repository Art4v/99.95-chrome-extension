import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: './src/manifest.json',
      watchFilePaths: ['src/**/*'],
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'date-utils': ['date-fns', 'date-fns-tz'],
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
});