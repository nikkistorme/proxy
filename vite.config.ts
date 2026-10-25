import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // PR previews build under /proxy/pr-preview/pr-N/; everything else uses /proxy/.
  base: process.env.VITE_BASE ?? '/proxy/',
  plugins: [react()],
});
