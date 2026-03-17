import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { user } from '../db/schema/auth-schema.js';
import type { App } from '../index.js';

export function registerLeaderboardRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/leaderboard/weekly - Get top 100 weekly scores
  fastify.get('/api/leaderboard/weekly', {
    schema: {
      description: 'Get top 100 users by weekly score',
      tags: ['leaderboard'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'integer' },
              userId: { type: 'string' },
              name: { type: 'string' },
              weeklyScore: { type: 'integer' },
              image: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  }, async () => {
    app.logger.info('Fetching weekly leaderboard');
    const leaderboard = await app.db
      .select({
        userId: schema.userStats.userId,
        name: user.name,
        weeklyScore: schema.userStats.weeklyScore,
        image: user.image,
      })
      .from(schema.userStats)
      .innerJoin(user, eq(schema.userStats.userId, user.id))
      .orderBy(desc(schema.userStats.weeklyScore))
      .limit(100);

    const withRank = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    app.logger.info({ count: withRank.length }, 'Weekly leaderboard fetched');
    return withRank;
  });

  // GET /api/leaderboard/alltime - Get top 100 all-time scores
  fastify.get('/api/leaderboard/alltime', {
    schema: {
      description: 'Get top 100 users by all-time high score',
      tags: ['leaderboard'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'integer' },
              userId: { type: 'string' },
              name: { type: 'string' },
              highScore: { type: 'integer' },
              image: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  }, async () => {
    app.logger.info('Fetching all-time leaderboard');
    const leaderboard = await app.db
      .select({
        userId: schema.userStats.userId,
        name: user.name,
        highScore: schema.userStats.highScore,
        image: user.image,
      })
      .from(schema.userStats)
      .innerJoin(user, eq(schema.userStats.userId, user.id))
      .orderBy(desc(schema.userStats.highScore))
      .limit(100);

    const withRank = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    app.logger.info({ count: withRank.length }, 'All-time leaderboard fetched');
    return withRank;
  });

  // GET /api/leaderboard/user - Get user's leaderboard position
  fastify.get('/api/leaderboard/user', {
    schema: {
      description: 'Get current user position on leaderboards',
      tags: ['leaderboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            weeklyRank: { type: 'integer' },
            weeklyScore: { type: 'integer' },
            alltimeRank: { type: 'integer' },
            highScore: { type: 'integer' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user leaderboard position');

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

      // Get weekly rank
      const weeklyHigherScores = await app.db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(schema.userStats)
        .where(sql`${schema.userStats.weeklyScore} > ${userStats.weeklyScore}`);

      const weeklyRank = (weeklyHigherScores[0]?.count || 0) + 1;

      // Get all-time rank
      const alltimeHigherScores = await app.db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(schema.userStats)
        .where(sql`${schema.userStats.highScore} > ${userStats.highScore}`);

      const alltimeRank = (alltimeHigherScores[0]?.count || 0) + 1;

      const result = {
        weeklyRank,
        weeklyScore: userStats.weeklyScore,
        alltimeRank,
        highScore: userStats.highScore,
      };

      app.logger.info(
        { userId: session.user.id, weeklyRank, alltimeRank },
        'User leaderboard position fetched'
      );
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch user leaderboard position');
      throw error;
    }
  });
}
