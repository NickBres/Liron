import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const useLocalHttps = mode === 'https';

  return {
    root: '.',
    base: mode === 'production' ? '/Liron/' : '/',
    server: {
      open: useLocalHttps ? false : '/',
      host: true,
      https: useLocalHttps
    },
    plugins: useLocalHttps ? [basicSsl()] : []
  };
});
