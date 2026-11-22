import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> normal static site (deploy dist/ to Vercel/Netlify/Cloudflare Pages)
// `npm run build:single` -> one self-contained index.html (handy for offline use / sharing)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
