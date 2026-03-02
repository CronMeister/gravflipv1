import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

const STORE_ITEMS = [
  // Skins
  { name: 'Classic Blue', description: 'Change your character to a cool blue color', price: 5000, icon: 'palette', category: 'skin' },
  { name: 'Neon Green', description: 'Glow in the dark with this neon skin', price: 7500, icon: 'palette', category: 'skin' },
  { name: 'Fire Red', description: 'Blazing hot red character skin', price: 10000, icon: 'palette', category: 'skin' },
  { name: 'Golden Shine', description: 'Luxurious golden character', price: 15000, icon: 'palette', category: 'skin' },
  { name: 'Rainbow', description: 'Cycle through all colors', price: 20000, icon: 'palette', category: 'skin' },
  // World Packs
  { name: 'Space Theme', description: 'Play in outer space with stars and planets', price: 10000, icon: 'public', category: 'world_pack' },
  { name: 'Ocean Depths', description: 'Underwater adventure with sea creatures', price: 10000, icon: 'waves', category: 'world_pack' },
  { name: 'Neon City', description: 'Futuristic cyberpunk cityscape', price: 15000, icon: 'location-city', category: 'world_pack' },
  { name: 'Forest Grove', description: 'Natural forest environment', price: 10000, icon: 'park', category: 'world_pack' },
  { name: 'Desert Storm', description: 'Sandy desert with cacti', price: 10000, icon: 'wb-sunny', category: 'world_pack' },
  // Shields
  { name: 'Basic Shield', description: 'Protects from 1 collision', price: 5000, icon: 'shield', category: 'shield' },
  { name: 'Double Shield', description: 'Protects from 2 collisions', price: 10000, icon: 'shield', category: 'shield' },
  { name: 'Triple Shield', description: 'Protects from 3 collisions', price: 15000, icon: 'shield', category: 'shield' },
  { name: 'Mega Shield', description: 'Protects from 5 collisions', price: 25000, icon: 'shield', category: 'shield' },
  // Power-ups
  { name: 'Slow Motion', description: 'Slows down the game for 10 seconds', price: 7500, icon: 'slow-motion-video', category: 'powerup' },
  { name: 'Coin Magnet', description: 'Doubles coins earned for 5 games', price: 10000, icon: 'attach-money', category: 'powerup' },
  { name: 'Score Booster', description: '2x score multiplier for 3 games', price: 12500, icon: 'trending-up', category: 'powerup' },
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
            created: { type: 'integer' },
            total: { type: 'integer' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    app.logger.info('Starting store seed operation');
    try {
      let createdCount = 0;

      for (const item of STORE_ITEMS) {
        const existing = await app.db.query.storeItems.findFirst({
          where: eq(schema.storeItems.name, item.name),
        });

        if (!existing) {
          await app.db.insert(schema.storeItems).values(item);
          createdCount++;
          app.logger.info({ itemName: item.name }, 'Created store item');
        }
      }

      app.logger.info({ createdCount, totalItems: STORE_ITEMS.length }, 'Store seed completed');
      return {
        created: createdCount,
        total: STORE_ITEMS.length,
        message: `Created ${createdCount} items. Total store items: ${STORE_ITEMS.length}`,
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
              price: { type: 'integer', description: 'Price in ZAR cents' },
              icon: { type: 'string' },
              category: { type: 'string' },
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
      .orderBy(asc(schema.storeItems.category), asc(schema.storeItems.price));
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
}
