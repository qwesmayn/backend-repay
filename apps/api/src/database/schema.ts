// Единая точка сборки схемы для drizzle({ schema }) и drizzle-kit.
// Таблицы живут в модулях (одна таблица — один файл), связи — в relations.ts.
export * from '../modules/merchants/schema/index.js';
export * from './relations.js';
