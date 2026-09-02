import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    // The browser holds no credentials. Everything that needs one goes to the
    // proxy in server/, which is started alongside Vite by `npm run dev`.
    proxy: {
      '/api': {
        target: process.env.PROXY_ORIGIN || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
