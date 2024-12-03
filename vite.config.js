import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Only for React projects

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      path: 'path-browserify',
      os: 'os-browserify/browser',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      vm: 'vm-browserify',
      process: 'process/browser',
      http: 'stream-http',
      https: 'https-browserify',
      querystring: 'querystring-es3',
      buffer: 'buffer',
      zlib: 'browserify-zlib',
      global: 'global',
    },
  },
  define: {
    global: 'window',
    'process.env': {    NODE_ENV: JSON.stringify(process.env.NODE_ENV),
    },
  },
});
