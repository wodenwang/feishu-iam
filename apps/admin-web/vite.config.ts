/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';

type UserConfigWithTest = UserConfig & {
  test: {
    environment: 'jsdom';
    globals: true;
    setupFiles: [];
  };
};

const config: UserConfigWithTest = {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/admin/auth': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/ready': 'http://localhost:3000',
      '/version': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: []
  }
};

export default defineConfig(config);
