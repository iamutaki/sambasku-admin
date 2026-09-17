import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    // Dev lokal HARUS same-origin lewat proxy ini - kalau tidak, frontend
    // (http://localhost:5174) cross-site ke API, cookie refresh_token
    // (sameSite=Strict, auth.controller.ts) tidak dikirim browser saat
    // reload → refresh gagal → sesi "amnesia" ke halaman login.
    // Dengan proxy, semua request keluar dari origin yang sama (localhost),
    // cookie tersimpan di localhost, dan CORS tidak diperlukan.
    // Wajib set VITE_API_BASE_URL=/api/v1 (lihat .env.development).
    proxy: {
      '/api': {
        target: 'https://sambasku-staging.iamutaki.com',
        changeOrigin: true,
      },
    },
  },
});