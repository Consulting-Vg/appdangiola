import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    allowedHosts: ['freely-nape-parameter.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  }
});
