import { pgTable, text, timestamp, uuid, integer, boolean, index, date, primaryKey } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const storeItems = pgTable('store_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // ZAR cents
  icon: text('icon').notNull(),
  category: text('category').notNull(),
  rarity: text('rarity').notNull().default('common'),
  currencyType: text('currency_type').notNull().default('flux'),
  tab: text('tab').notNull().default('skins'),
  iapProductId: text('iap_product_id'),
  priceDisplay: text('price_display'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userEquipped = pgTable('user_equipped', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  slot: text('slot').notNull(),
  itemId: uuid('item_id').references(() => storeItems.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.slot] }),
}));

export const dailyStreak = pgTable('daily_streak', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  lastClaimedDate: date('last_claimed_date'),
  totalClaimed: integer('total_claimed').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dailyRewardClaims = pgTable('daily_reward_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  dayNumber: integer('day_number').notNull(),
  rewardType: text('reward_type').notNull(),
  rewardValue: integer('reward_value'),
  rewardItemId: uuid('reward_item_id').references(() => storeItems.id, { onDelete: 'set null' }),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_daily_reward_claims_user_id').on(table.userId),
]);

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

export const objectives = pgTable('objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  target_value: integer('target_value').notNull(),
  reward_coins: integer('reward_coins').notNull(),
  icon: text('icon').notNull(),
  kind: text('kind').notNull(),
  code: text('code'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_objectives_code').on(table.code),
]);

export const userObjectives = pgTable('user_objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  objective_id: uuid('objective_id').notNull().references(() => objectives.id, { onDelete: 'cascade' }),
  progress: integer('progress').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  date_utc: text('date_utc'),
  device_id: text('device_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_objectives_objective_id').on(table.objective_id),
  index('idx_user_objectives_date').on(table.date),
  index('idx_user_objectives_device_date').on(table.device_id, table.date),
  index('idx_user_objectives_device_date_utc').on(table.device_id, table.date_utc),
]);
