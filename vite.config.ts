import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2020',
    // Don't inline everything — Capacitor needs separate files
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Split large deps into separate chunks for better caching
        manualChunks: {
          react:     ['react', 'react-dom'],
          tesseract: ['tesseract.js'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'tesseract.js'],
  },
});
