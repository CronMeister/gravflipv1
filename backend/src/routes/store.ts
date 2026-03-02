import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

export function registerStoreRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

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
    const items = await app.db.select().from(schema.storeItems);
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

      const userStats = await app.db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, session.user.id),
      });

      if (!userStats || userStats.totalCoins < item.price) {
        app.logger.warn(
          { userId: session.user.id, itemPrice: item.price, userCoins: userStats?.totalCoins || 0 },
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
