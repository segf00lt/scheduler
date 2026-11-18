import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api é encaminhado para o back-end (porta 3001).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
