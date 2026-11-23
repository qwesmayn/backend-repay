import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC нужен для emitDecoratorMetadata: без него DI NestJS в тестах не работает.
  resolve: { tsconfigPaths: true },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    // Тестовое окружение: ConfigModule в тестах не читает .env (см. config.options.ts).
    env: { DB_HOST: 'localhost', DB_USERNAME: 'repay', DB_PASSWORD: 'repay', DB_DATABASE: 'repay' },
    include: ['src/**/*.spec.ts'],
  },
});
