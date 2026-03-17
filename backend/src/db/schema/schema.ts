import { pgTable, text, timestamp, uuid, integer, boolean, index } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const storeItems = pgTable('store_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // ZAR cents
  icon: text('icon').notNull(),
  category: text('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userPurchases = pgTable('user_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => storeItems.id, { onDelete: 'cascade' }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_purchases_user_id').on(table.userId),
  index('idx_user_purchases_item_id').on(table.itemId),
]);

export const userStats = pgTable('user_stats', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  highScore: integer('high_score').notNull().default(0),
  totalCoins: integer('total_coins').notNull().default(0),
  weeklyScore: integer('weekly_score').notNull().default(0),
  lastScoreUpdate: timestamp('last_score_update', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_stats_high_score').on(table.highScore),
  index('idx_user_stats_weekly_score').on(table.weeklyScore),
]);

export const dailyObjectives = pgTable('daily_objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  targetValue: integer('target_value').notNull(),
  rewardCoins: integer('reward_coins').notNull(),
  icon: text('icon').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_daily_objectives_date').on(table.date),
]);

export const userObjectives = pgTable('user_objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  objectiveId: uuid('objective_id').notNull().references(() => dailyObjectives.id, { onDelete: 'cascade' }),
  progress: integer('progress').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_objectives_user_id').on(table.userId),
  index('idx_user_objectives_objective_id').on(table.objectiveId),
  index('idx_user_objectives_date').on(table.date),
  index('idx_user_objectives_user_date').on(table.userId, table.date),
]);
