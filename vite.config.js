import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Web3.js v4 node polyfills
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
});
