import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { schedulerBridge } from './bridge/schedulerBridge.js';

// A API não é um servidor separado: a ponte importa a lógica de back/scheduler.ts
// dentro do próprio servidor do Vite, tanto no `npm run dev` quanto no `npm run preview`.
export default defineConfig({
  plugins: [
    react(),
    schedulerBridge({ frontendDir: fileURLToPath(new URL('.', import.meta.url)) }),
  ],
});
