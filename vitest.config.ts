import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __APP_ID__: JSON.stringify('crate'),
    __APP_NAME__: JSON.stringify('Crate'),
    __APP_VERSION__: JSON.stringify('test'),
    __DEV__: 'false',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
