import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    // Тестовое окружение: ConfigModule в тестах не читает .env (см. config.options.ts).
    env: { DB_HOST: 'localhost', DB_USERNAME: 'repay', DB_PASSWORD: 'repay', DB_DATABASE: 'repay' },
    include: ['test/**/*.e2e-spec.ts'],
  },
});
