import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

export function registerStatsRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/stats - Get user stats
  fastify.get('/api/stats', {
    schema: {
      description: 'Get current user stats',
      tags: ['stats'],
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            highScore: { type: 'integer' },
            totalCoins: { type: 'integer' },
            weeklyScore: { type: 'integer' },
            lastScoreUpdate: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user stats');

    try {
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

      app.logger.info(
        { userId: session.user.id, highScore: userStats.highScore, totalCoins: userStats.totalCoins },
        'User stats fetched'
      );
      return userStats;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch user stats');
      throw error;
    }
  });

  // POST /api/stats/score - Update score and award coins
  fastify.post<{ Body: { score: number } }>('/api/stats/score', {
    schema: {
      description: 'Update user score and award coins',
      tags: ['stats'],
      body: {
        type: 'object',
        required: ['score'],
        properties: {
          score: { type: 'integer', description: 'Score value to add' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            highScore: { type: 'integer' },
            totalCoins: { type: 'integer' },
            weeklyScore: { type: 'integer' },
            coinsAwarded: { type: 'integer' },
            lastScoreUpdate: { type: 'string', format: 'date-time' },
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
  }, async (request: FastifyRequest<{ Body: { score: number } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { score } = request.body;

    // Validation: score must be a non-negative integer
    if (!Number.isInteger(score) || score < 0) {
      app.logger.warn({ userId: session.user.id, score }, 'Invalid score value');
      return reply.status(400).send({ error: 'Score must be a non-negative integer' });
    }

    const coinsAwarded = score;

    try {
      let userStats = await app.db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, session.user.id),
      });

      // Create user stats if not exists
      if (!userStats) {
        app.logger.info({ userId: session.user.id }, 'Creating new user stats');
        const created = await app.db.insert(schema.userStats).values({
          userId: session.user.id,
          highScore: score,
          totalCoins: coinsAwarded,
          weeklyScore: score,
        }).returning();
        userStats = created[0];
      } else {
        // Update existing stats
        const newHighScore = Math.max(userStats.highScore, score);
        const newWeeklyScore = userStats.weeklyScore + score;
        const newTotalCoins = userStats.totalCoins + coinsAwarded;

        const updated = await app.db.update(schema.userStats).set({
          highScore: newHighScore,
          totalCoins: newTotalCoins,
          weeklyScore: newWeeklyScore,
          lastScoreUpdate: new Date(),
        }).where(eq(schema.userStats.userId, session.user.id)).returning();

        userStats = updated[0];
      }

      const newTotalCoins = userStats.totalCoins;
      app.logger.info(
        {
          userId: session.user.id,
          score,
          coinsAwarded,
          newTotalCoins,
        },
        'Score submitted'
      );

      return {
        userId: userStats.userId,
        highScore: userStats.highScore,
        totalCoins: userStats.totalCoins,
        weeklyScore: userStats.weeklyScore,
        coinsAwarded: coinsAwarded,
        lastScoreUpdate: userStats.lastScoreUpdate,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, score }, 'Failed to update score');
      throw error;
    }
  });
}
