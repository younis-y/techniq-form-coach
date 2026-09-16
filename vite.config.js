import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the project from /<repo>/, not from the domain root.
  // Local dev and `vite preview` keep the root base.
  base: process.env.GITHUB_ACTIONS ? '/techniq-form-coach/' : '/',
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
