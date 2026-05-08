import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, asc, sql } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

const DAILY_REWARD_SCHEDULE = [
  { dayNumber: 1, rewardType: 'flux', rewardValue: 100, itemName: null },
  { dayNumber: 2, rewardType: 'flux', rewardValue: 250, itemName: null },
  { dayNumber: 3, rewardType: 'item', rewardValue: null, itemName: 'Neon Trail' },
  { dayNumber: 4, rewardType: 'flux', rewardValue: 500, itemName: null },
  { dayNumber: 5, rewardType: 'item', rewardValue: null, itemName: 'Plasma Reactor' },
  { dayNumber: 6, rewardType: 'flux', rewardValue: 1000, itemName: null },
  { dayNumber: 7, rewardType: 'item', rewardValue: null, itemName: 'Quantum Core' },
];

const STORE_ITEMS_DATA = [
  // SKINS tab
  { id: '00000000-0000-0000-0000-000000000001', name: 'DEFAULT CORE', description: 'The original gravity core. Always free.', price: 0, icon: 'cube.fill', category: 'skin', rarity: 'common', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 0 },
  { name: 'Neon Cube', description: 'A vibrant neon-lit cube skin.', price: 100, icon: 'cube.fill', category: 'skin', rarity: 'common', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 1 },
  { name: 'Pulse Orb', description: 'A pulsating energy orb.', price: 150, icon: 'circle.fill', category: 'skin', rarity: 'common', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 2 },
  { name: 'Ice Core', description: 'A frozen crystalline core.', price: 200, icon: 'snowflake', category: 'skin', rarity: 'common', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 3 },
  { name: 'Ember Node', description: 'A smoldering ember node.', price: 250, icon: 'flame.fill', category: 'skin', rarity: 'common', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 4 },
  { name: 'Plasma Reactor', description: 'A high-energy plasma reactor.', price: 500, icon: 'bolt.fill', category: 'skin', rarity: 'rare', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 5 },
  { name: 'Toxic Prism', description: 'A toxic prismatic crystal.', price: 750, icon: 'triangle.fill', category: 'skin', rarity: 'rare', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 6 },
  { name: 'Cyber Cell', description: 'A cybernetic cell unit.', price: 1000, icon: 'cpu.fill', category: 'skin', rarity: 'rare', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 7 },
  { name: 'Quantum Core', description: 'A quantum-entangled core.', price: 2000, icon: 'atom', category: 'skin', rarity: 'epic', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 8 },
  { name: 'Void Fragment', description: 'A fragment of pure void energy.', price: 3000, icon: 'moon.stars.fill', category: 'skin', rarity: 'epic', currencyType: 'flux', tab: 'skins', iapProductId: null, priceDisplay: null, sortOrder: 9 },
  { name: 'Singularity Core', description: 'A legendary singularity core.', price: 199, icon: 'wand.and.stars', category: 'skin', rarity: 'legendary', currencyType: 'iap', tab: 'skins', iapProductId: 'gravflip_skin_singularity_199', priceDisplay: '$1.99', sortOrder: 10 },
  { name: 'Celestial Reactor', description: 'A celestial energy reactor.', price: 299, icon: 'sun.max.fill', category: 'skin', rarity: 'legendary', currencyType: 'iap', tab: 'skins', iapProductId: 'gravflip_skin_celestial_299', priceDisplay: '$2.99', sortOrder: 11 },
  { name: 'Inferno Pulse', description: 'An infernal pulsing core.', price: 499, icon: 'flame.fill', category: 'skin', rarity: 'legendary', currencyType: 'iap', tab: 'skins', iapProductId: 'gravflip_skin_inferno_499', priceDisplay: '$4.99', sortOrder: 12 },
  // TRAILS tab
  { name: 'Neon Trail', description: 'A glowing neon particle trail.', price: 150, icon: 'wind', category: 'trail', rarity: 'common', currencyType: 'flux', tab: 'trails', iapProductId: null, priceDisplay: null, sortOrder: 0 },
  { name: 'Pixel Trail', description: 'A retro pixel particle trail.', price: 250, icon: 'square.grid.2x2.fill', category: 'trail', rarity: 'common', currencyType: 'flux', tab: 'trails', iapProductId: null, priceDisplay: null, sortOrder: 1 },
  { name: 'Smoke Trail', description: 'A dense smoke trail.', price: 600, icon: 'cloud.fill', category: 'trail', rarity: 'rare', currencyType: 'flux', tab: 'trails', iapProductId: null, priceDisplay: null, sortOrder: 2 },
  { name: 'Electric Sparks', description: 'Crackling electric sparks trail.', price: 900, icon: 'bolt.fill', category: 'trail', rarity: 'rare', currencyType: 'flux', tab: 'trails', iapProductId: null, priceDisplay: null, sortOrder: 3 },
  { name: 'RGB Spectrum', description: 'A full RGB spectrum trail.', price: 199, icon: 'paintbrush.fill', category: 'trail', rarity: 'legendary', currencyType: 'iap', tab: 'trails', iapProductId: 'gravflip_trail_rgb_199', priceDisplay: '$1.99', sortOrder: 4 },
  { name: 'Black Hole Trail', description: 'A trail of gravitational darkness.', price: 299, icon: 'moon.fill', category: 'trail', rarity: 'legendary', currencyType: 'iap', tab: 'trails', iapProductId: 'gravflip_trail_blackhole_299', priceDisplay: '$2.99', sortOrder: 5 },
  { name: 'Plasma Storm', description: 'A raging plasma storm trail.', price: 399, icon: 'tornado', category: 'trail', rarity: 'legendary', currencyType: 'iap', tab: 'trails', iapProductId: 'gravflip_trail_plasma_399', priceDisplay: '$3.99', sortOrder: 6 },
  // THEMES tab
  { name: 'Retro Neon', description: 'Classic retro neon theme.', price: 500, icon: 'tv.fill', category: 'theme', rarity: 'common', currencyType: 'flux', tab: 'themes', iapProductId: null, priceDisplay: null, sortOrder: 0 },
  { name: 'Cyber Grid', description: 'A cyberpunk grid theme.', price: 750, icon: 'grid', category: 'theme', rarity: 'rare', currencyType: 'flux', tab: 'themes', iapProductId: null, priceDisplay: null, sortOrder: 1 },
  { name: 'Matrix Green', description: 'The classic matrix green theme.', price: 1000, icon: 'terminal.fill', category: 'theme', rarity: 'rare', currencyType: 'flux', tab: 'themes', iapProductId: null, priceDisplay: null, sortOrder: 2 },
  { name: 'Deep Space', description: 'An immersive deep space theme.', price: 199, icon: 'moon.stars.fill', category: 'theme', rarity: 'legendary', currencyType: 'iap', tab: 'themes', iapProductId: 'gravflip_theme_deepspace_199', priceDisplay: '$1.99', sortOrder: 3 },
  { name: 'Solar Storm', description: 'A blazing solar storm theme.', price: 299, icon: 'sun.max.fill', category: 'theme', rarity: 'legendary', currencyType: 'iap', tab: 'themes', iapProductId: 'gravflip_theme_solar_299', priceDisplay: '$2.99', sortOrder: 4 },
  { name: 'Vaporwave Night', description: 'A dreamy vaporwave night theme.', price: 399, icon: 'sparkles', category: 'theme', rarity: 'legendary', currencyType: 'iap', tab: 'themes', iapProductId: 'gravflip_theme_vaporwave_399', priceDisplay: '$3.99', sortOrder: 5 },
  // EFFECTS tab
  { name: 'Ripple', description: 'A ripple gravity effect.', price: 300, icon: 'waveform', category: 'effect', rarity: 'common', currencyType: 'flux', tab: 'effects', iapProductId: null, priceDisplay: null, sortOrder: 0 },
  { name: 'Shockwave', description: 'A powerful shockwave effect.', price: 500, icon: 'bolt.circle.fill', category: 'effect', rarity: 'rare', currencyType: 'flux', tab: 'effects', iapProductId: null, priceDisplay: null, sortOrder: 1 },
  { name: 'Pixel Burst', description: 'A retro pixel burst effect.', price: 750, icon: 'burst.fill', category: 'effect', rarity: 'rare', currencyType: 'flux', tab: 'effects', iapProductId: null, priceDisplay: null, sortOrder: 2 },
  { name: 'Void Implosion', description: 'A void implosion death effect.', price: 199, icon: 'circle.dotted', category: 'effect', rarity: 'legendary', currencyType: 'iap', tab: 'effects', iapProductId: 'gravflip_effect_void_199', priceDisplay: '$1.99', sortOrder: 3 },
  { name: 'Lightning Collapse', description: 'A lightning collapse effect.', price: 299, icon: 'bolt.trianglebadge.exclamationmark.fill', category: 'effect', rarity: 'legendary', currencyType: 'iap', tab: 'effects', iapProductId: 'gravflip_effect_lightning_299', priceDisplay: '$2.99', sortOrder: 4 },
  { name: 'Dimensional Tear', description: 'A dimensional tear effect.', price: 399, icon: 'scissors', category: 'effect', rarity: 'legendary', currencyType: 'iap', tab: 'effects', iapProductId: 'gravflip_effect_dimensional_399', priceDisplay: '$3.99', sortOrder: 5 },
  // PREMIUM tab
  { name: 'Small Flux Pack', description: '1000 Flux', price: 99, icon: 'dollarsign.circle.fill', category: 'flux_pack', rarity: 'common', currencyType: 'iap', tab: 'premium', iapProductId: 'gravflip_flux_small_099', priceDisplay: '$0.99', sortOrder: 0 },
  { name: 'Medium Flux Pack', description: '3500 Flux', price: 299, icon: 'dollarsign.circle.fill', category: 'flux_pack', rarity: 'rare', currencyType: 'iap', tab: 'premium', iapProductId: 'gravflip_flux_medium_299', priceDisplay: '$2.99', sortOrder: 1 },
  { name: 'Large Flux Pack', description: '7000 Flux', price: 499, icon: 'dollarsign.circle.fill', category: 'flux_pack', rarity: 'epic', currencyType: 'iap', tab: 'premium', iapProductId: 'gravflip_flux_large_499', priceDisplay: '$4.99', sortOrder: 2 },
  { name: 'Ultra Flux Pack', description: '15000 Flux', price: 999, icon: 'dollarsign.circle.fill', category: 'flux_pack', rarity: 'legendary', currencyType: 'iap', tab: 'premium', iapProductId: 'gravflip_flux_ultra_999', priceDisplay: '$9.99', sortOrder: 3 },
];

export function registerStoreRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/store/seed - Populate store items
  fastify.post('/api/store/seed', {
    schema: {
      description: 'Seed store items (populate initial inventory)',
      tags: ['store'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'integer' },
          },
        },
      },
    },
  }, async () => {
    app.logger.info('Starting store seed operation');
    try {
      // Delete existing data
      await app.db.delete(schema.userEquipped);
      await app.db.delete(schema.dailyRewardClaims);
      await app.db.delete(schema.userPurchases);
      await app.db.delete(schema.storeItems);

      app.logger.info('Cleared existing store items and related data');

      // Insert new items
      for (const item of STORE_ITEMS_DATA) {
        if ('id' in item && item.id) {
          // Insert with specific ID for DEFAULT CORE
          await app.db.insert(schema.storeItems).values({
            id: item.id as any,
            name: item.name,
            description: item.description,
            price: item.price,
            icon: item.icon,
            category: item.category,
            rarity: item.rarity,
            currencyType: item.currencyType,
            tab: item.tab,
            iapProductId: item.iapProductId,
            priceDisplay: item.priceDisplay,
            sortOrder: item.sortOrder,
          });
        } else {
          // Insert with generated ID
          await app.db.insert(schema.storeItems).values({
            name: item.name,
            description: item.description,
            price: item.price,
            icon: item.icon,
            category: item.category,
            rarity: item.rarity,
            currencyType: item.currencyType,
            tab: item.tab,
            iapProductId: item.iapProductId,
            priceDisplay: item.priceDisplay,
            sortOrder: item.sortOrder,
          });
        }
      }

      app.logger.info({ count: STORE_ITEMS_DATA.length }, 'Store seed completed');
      return {
        success: true,
        count: STORE_ITEMS_DATA.length,
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to seed store items');
      throw error;
    }
  });

  // GET /api/store/items - Get all store items
  fastify.get('/api/store/items', {
    schema: {
      description: 'Get all available store items',
      tags: ['store'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'integer' },
              icon: { type: 'string' },
              category: { type: 'string' },
              rarity: { type: 'string' },
              currencyType: { type: 'string' },
              tab: { type: 'string' },
              iapProductId: { type: ['string', 'null'] },
              priceDisplay: { type: ['string', 'null'] },
              sortOrder: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async () => {
    app.logger.info('Fetching all store items');
    const items = await app.db
      .select()
      .from(schema.storeItems)
      .orderBy(asc(schema.storeItems.tab), asc(schema.storeItems.sortOrder));
    app.logger.info({ count: items.length }, 'Store items fetched');
    return items;
  });

  // GET /api/store/purchases - Get user's purchases
  fastify.get('/api/store/purchases', {
    schema: {
      description: 'Get current user purchases',
      tags: ['store'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string' },
              itemId: { type: 'string', format: 'uuid' },
              purchasedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user purchases');
    const purchases = await app.db.select().from(schema.userPurchases).where(
      eq(schema.userPurchases.userId, session.user.id)
    );
    app.logger.info({ userId: session.user.id, count: purchases.length }, 'User purchases fetched');
    return purchases;
  });

  // GET /api/store/equipped - Get user's equipped items
  fastify.get('/api/store/equipped', {
    schema: {
      description: 'Get current user equipped items',
      tags: ['store'],
      response: {
        200: {
          type: 'object',
          properties: {
            skin: { type: ['object', 'null'] },
            trail: { type: ['object', 'null'] },
            theme: { type: ['object', 'null'] },
            gravity_effect: { type: ['object', 'null'] },
            death_effect: { type: ['object', 'null'] },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user equipped items');

    const equipped = await app.db.select().from(schema.userEquipped).where(
      eq(schema.userEquipped.userId, session.user.id)
    );

    const result: any = {
      skin: null,
      trail: null,
      theme: null,
      gravity_effect: null,
      death_effect: null,
    };

    for (const eq_item of equipped) {
      if (eq_item.itemId) {
        const item = await app.db.query.storeItems.findFirst({
          where: eq(schema.storeItems.id, eq_item.itemId),
        });
        if (item) {
          result[eq_item.slot as keyof typeof result] = {
            item_id: eq_item.itemId,
            item,
          };
        }
      }
    }

    app.logger.info({ userId: session.user.id }, 'User equipped items fetched');
    return result;
  });

  // POST /api/store/equip - Equip an item
  fastify.post<{ Body: { itemId: string; slot: string } }>('/api/store/equip', {
    schema: {
      description: 'Equip an item to a slot',
      tags: ['store'],
      body: {
        type: 'object',
        required: ['itemId', 'slot'],
        properties: {
          itemId: { type: 'string', format: 'uuid' },
          slot: { type: 'string', enum: ['skin', 'trail', 'theme', 'gravity_effect', 'death_effect'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            slot: { type: 'string' },
            itemId: { type: 'string', format: 'uuid' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        403: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { itemId: string; slot: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { itemId, slot } = request.body;
    app.logger.info({ userId: session.user.id, itemId, slot }, 'Equipping item');

    try {
      // Check if user owns the item
      const purchase = await app.db.query.userPurchases.findFirst({
        where: and(
          eq(schema.userPurchases.userId, session.user.id),
          eq(schema.userPurchases.itemId, itemId)
        ),
      });

      if (!purchase) {
        app.logger.warn({ userId: session.user.id, itemId }, 'Item not owned by user');
        return reply.status(403).send({ error: 'Item not owned' });
      }

      // Upsert the equipped item
      await app.db
        .insert(schema.userEquipped)
        .values({
          userId: session.user.id,
          slot,
          itemId,
          updatedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: [schema.userEquipped.userId, schema.userEquipped.slot],
          set: {
            itemId: sql`excluded.item_id`,
            updatedAt: sql`now()`,
          },
        });

      app.logger.info({ userId: session.user.id, itemId, slot }, 'Item equipped successfully');
      return {
        success: true,
        slot,
        itemId,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, itemId, slot }, 'Failed to equip item');
      throw error;
    }
  });

  // POST /api/store/purchase - Purchase an item
  fastify.post<{ Body: { itemId: string } }>('/api/store/purchase', {
    schema: {
      description: 'Purchase an item from the store',
      tags: ['store'],
      body: {
        type: 'object',
        required: ['itemId'],
        properties: {
          itemId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            itemId: { type: 'string', format: 'uuid' },
            purchasedAt: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { itemId: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { itemId } = request.body;
    app.logger.info({ userId: session.user.id, itemId }, 'Processing purchase');

    try {
      const item = await app.db.query.storeItems.findFirst({
        where: eq(schema.storeItems.id, itemId),
      });

      if (!item) {
        app.logger.warn({ itemId }, 'Item not found');
        return reply.status(404).send({ error: 'Item not found' });
      }

      let userStats = await app.db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, session.user.id),
      });

      // Create default stats if they don't exist
      if (!userStats) {
        app.logger.info({ userId: session.user.id }, 'Creating default user stats');
        const created = await app.db.insert(schema.userStats).values({
          userId: session.user.id,
          highScore: 0,
          totalCoins: 50000, // Starting coins: R500
          weeklyScore: 0,
        }).returning();
        userStats = created[0];
      }

      if (userStats.totalCoins < item.price) {
        app.logger.warn(
          { userId: session.user.id, itemPrice: item.price, userCoins: userStats.totalCoins },
          'Insufficient coins'
        );
        return reply.status(400).send({ error: 'Insufficient coins' });
      }

      const purchase = await app.db.insert(schema.userPurchases).values({
        userId: session.user.id,
        itemId,
      }).returning();

      // Deduct coins from user stats
      await app.db.update(schema.userStats).set({
        totalCoins: userStats.totalCoins - item.price,
      }).where(eq(schema.userStats.userId, session.user.id));

      app.logger.info(
        { userId: session.user.id, purchaseId: purchase[0].id, itemId, coinsDeducted: item.price },
        'Purchase completed successfully'
      );
      return reply.status(201).send(purchase[0]);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, itemId }, 'Failed to process purchase');
      throw error;
    }
  });

  // GET /api/store/daily-streak - Get user's daily streak
  fastify.get('/api/store/daily-streak', {
    schema: {
      description: 'Get current user daily streak information',
      tags: ['store'],
      response: {
        200: {
          type: 'object',
          properties: {
            currentStreak: { type: 'integer' },
            lastClaimedDate: { type: ['string', 'null'] },
            canClaimToday: { type: 'boolean' },
            nextReward: {
              type: 'object',
              properties: {
                dayNumber: { type: 'integer' },
                rewardType: { type: 'string' },
                rewardValue: { type: ['integer', 'null'] },
                item: { type: ['object', 'null'] },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching daily streak');

    try {
      let streak = await app.db.query.dailyStreak.findFirst({
        where: eq(schema.dailyStreak.userId, session.user.id),
      });

      if (!streak) {
        streak = {
          userId: session.user.id,
          currentStreak: 0,
          lastClaimedDate: null,
          totalClaimed: 0,
          updatedAt: new Date(),
        };
      }

      const today = new Date().toISOString().split('T')[0];
      const lastClaimedStr = streak.lastClaimedDate ? String(streak.lastClaimedDate) : null;
      const canClaimToday = !lastClaimedStr || lastClaimedStr < today;

      const nextDayNumber = ((streak.currentStreak % 7) + 1);
      const rewardSchedule = DAILY_REWARD_SCHEDULE.find(r => r.dayNumber === nextDayNumber)!;

      let nextReward: any = {
        dayNumber: nextDayNumber,
        rewardType: rewardSchedule.rewardType,
        rewardValue: rewardSchedule.rewardValue,
        item: null,
      };

      if (rewardSchedule.rewardType === 'item' && rewardSchedule.itemName) {
        const item = await app.db.query.storeItems.findFirst({
          where: eq(schema.storeItems.name, rewardSchedule.itemName),
        });
        if (item) {
          nextReward.item = item;
        }
      }

      const result = {
        currentStreak: streak.currentStreak,
        lastClaimedDate: lastClaimedStr,
        canClaimToday,
        nextReward,
      };

      app.logger.info({ userId: session.user.id, currentStreak: streak.currentStreak }, 'Daily streak fetched');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch daily streak');
      throw error;
    }
  });

  // POST /api/store/claim-daily - Claim daily reward
  fastify.post('/api/store/claim-daily', {
    schema: {
      description: 'Claim daily reward',
      tags: ['store'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            reward: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                value: { type: ['integer', 'null'] },
                item: { type: ['object', 'null'] },
              },
            },
            newStreak: { type: 'integer' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Claiming daily reward');

    try {
      let streak = await app.db.query.dailyStreak.findFirst({
        where: eq(schema.dailyStreak.userId, session.user.id),
      });

      const today = new Date().toISOString().split('T')[0];
      const lastClaimedStr = streak?.lastClaimedDate ? String(streak.lastClaimedDate) : null;

      if (lastClaimedStr && lastClaimedStr >= today) {
        app.logger.warn({ userId: session.user.id }, 'Already claimed today');
        return reply.status(400).send({ error: 'Already claimed today' });
      }

      const currentStreak = streak?.currentStreak ?? 0;
      const dayNumber = ((currentStreak % 7) + 1);
      const rewardSchedule = DAILY_REWARD_SCHEDULE.find(r => r.dayNumber === dayNumber)!;

      let rewardValue = null;
      let rewardItem = null;

      if (rewardSchedule.rewardType === 'flux') {
        rewardValue = rewardSchedule.rewardValue;

        // Get or create user stats
        let userStats = await app.db.query.userStats.findFirst({
          where: eq(schema.userStats.userId, session.user.id),
        });

        if (!userStats) {
          await app.db.insert(schema.userStats).values({
            userId: session.user.id,
            highScore: 0,
            totalCoins: rewardValue,
            weeklyScore: 0,
          });
        } else {
          await app.db.update(schema.userStats)
            .set({
              totalCoins: userStats.totalCoins + rewardValue,
            })
            .where(eq(schema.userStats.userId, session.user.id));
        }
      } else if (rewardSchedule.rewardType === 'item' && rewardSchedule.itemName) {
        const item = await app.db.query.storeItems.findFirst({
          where: eq(schema.storeItems.name, rewardSchedule.itemName),
        });

        if (item) {
          rewardItem = item;

          // Check if user already owns the item
          const existingPurchase = await app.db.query.userPurchases.findFirst({
            where: and(
              eq(schema.userPurchases.userId, session.user.id),
              eq(schema.userPurchases.itemId, item.id)
            ),
          });

          if (!existingPurchase) {
            await app.db.insert(schema.userPurchases).values({
              userId: session.user.id,
              itemId: item.id,
            });
          }
        }
      }

      // Insert reward claim
      await app.db.insert(schema.dailyRewardClaims).values({
        userId: session.user.id,
        dayNumber,
        rewardType: rewardSchedule.rewardType,
        rewardValue,
        rewardItemId: rewardItem?.id || null,
      });

      // Update or create daily streak
      const newStreak = currentStreak + 1;
      if (streak) {
        await app.db.update(schema.dailyStreak)
          .set({
            currentStreak: newStreak,
            lastClaimedDate: sql`CURRENT_DATE`,
            totalClaimed: streak.totalClaimed + 1,
            updatedAt: sql`now()`,
          })
          .where(eq(schema.dailyStreak.userId, session.user.id));
      } else {
        await app.db.insert(schema.dailyStreak).values({
          userId: session.user.id,
          currentStreak: newStreak,
          lastClaimedDate: sql`CURRENT_DATE`,
          totalClaimed: 1,
        });
      }

      app.logger.info({ userId: session.user.id, dayNumber, newStreak }, 'Daily reward claimed');

      return {
        success: true,
        reward: {
          type: rewardSchedule.rewardType,
          value: rewardValue,
          item: rewardItem || null,
        },
        newStreak,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to claim daily reward');
      throw error;
    }
  });
}
