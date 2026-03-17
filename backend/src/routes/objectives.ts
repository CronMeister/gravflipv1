import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

export function registerObjectivesRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/objectives/daily - Get today's objectives with progress
  fastify.get('/api/objectives/daily', {
    schema: {
      description: "Get today's objectives with user progress",
      tags: ['objectives'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              objective: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  targetValue: { type: 'integer' },
                  rewardCoins: { type: 'integer' },
                  icon: { type: 'string' },
                  date: { type: 'string', format: 'date-time' },
                },
              },
              userProgress: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  progress: { type: 'integer' },
                  completed: { type: 'boolean' },
                  completedAt: { type: ['string', 'null'], format: 'date-time' },
                },
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

    app.logger.info({ userId: session.user.id }, 'Fetching daily objectives');

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const objectives = await app.db
        .select({
          objectiveId: schema.dailyObjectives.id,
          title: schema.dailyObjectives.title,
          description: schema.dailyObjectives.description,
          targetValue: schema.dailyObjectives.targetValue,
          rewardCoins: schema.dailyObjectives.rewardCoins,
          icon: schema.dailyObjectives.icon,
          date: schema.dailyObjectives.date,
          userProgressId: schema.userObjectives.id,
          progress: schema.userObjectives.progress,
          completed: schema.userObjectives.completed,
          completedAt: schema.userObjectives.completedAt,
        })
        .from(schema.dailyObjectives)
        .leftJoin(
          schema.userObjectives,
          and(
            eq(schema.dailyObjectives.id, schema.userObjectives.objectiveId),
            eq(schema.userObjectives.userId, session.user.id),
            and(
              gte(schema.userObjectives.date, today),
              lt(schema.userObjectives.date, tomorrow)
            )
          )
        )
        .where(
          and(
            gte(schema.dailyObjectives.date, today),
            lt(schema.dailyObjectives.date, tomorrow)
          )
        );

      const result = objectives.map((obj) => ({
        objective: {
          id: obj.objectiveId,
          title: obj.title,
          description: obj.description,
          targetValue: obj.targetValue,
          rewardCoins: obj.rewardCoins,
          icon: obj.icon,
          date: obj.date,
        },
        userProgress: obj.userProgressId ? {
          id: obj.userProgressId,
          progress: obj.progress,
          completed: obj.completed,
          completedAt: obj.completedAt,
        } : {
          id: null,
          progress: 0,
          completed: false,
          completedAt: null,
        },
      }));

      app.logger.info({ userId: session.user.id, count: result.length }, 'Daily objectives fetched');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch daily objectives');
      throw error;
    }
  });

  // POST /api/objectives/progress - Update objective progress
  fastify.post<{ Body: { objectiveId: string; progress: number } }>('/api/objectives/progress', {
    schema: {
      description: 'Update progress on an objective',
      tags: ['objectives'],
      body: {
        type: 'object',
        required: ['objectiveId', 'progress'],
        properties: {
          objectiveId: { type: 'string', format: 'uuid' },
          progress: { type: 'integer' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            objectiveId: { type: 'string', format: 'uuid' },
            progress: { type: 'integer' },
            completed: { type: 'boolean' },
            completedAt: { type: ['string', 'null'], format: 'date-time' },
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
  }, async (request: FastifyRequest<{ Body: { objectiveId: string; progress: number } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { objectiveId, progress } = request.body;

    if (typeof progress !== 'number' || progress < 0) {
      app.logger.warn({ userId: session.user.id, objectiveId, progress }, 'Invalid progress value');
      return reply.status(400).send({ error: 'Progress must be a non-negative number' });
    }

    app.logger.info({ userId: session.user.id, objectiveId, progress }, 'Updating objective progress');

    try {
      const objective = await app.db.query.dailyObjectives.findFirst({
        where: eq(schema.dailyObjectives.id, objectiveId),
      });

      if (!objective) {
        app.logger.warn({ objectiveId }, 'Objective not found');
        return reply.status(404).send({ error: 'Objective not found' });
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      let userObjective = await app.db.query.userObjectives.findFirst({
        where: and(
          eq(schema.userObjectives.userId, session.user.id),
          eq(schema.userObjectives.objectiveId, objectiveId),
          gte(schema.userObjectives.date, today)
        ),
      });

      if (!userObjective) {
        // Create new user objective
        const created = await app.db.insert(schema.userObjectives).values({
          userId: session.user.id,
          objectiveId,
          progress,
          completed: false,
          date: today,
        }).returning();
        userObjective = created[0];
      } else {
        // Update existing user objective
        const updated = await app.db.update(schema.userObjectives).set({
          progress,
        }).where(eq(schema.userObjectives.id, userObjective.id)).returning();
        userObjective = updated[0];
      }

      app.logger.info(
        { userId: session.user.id, objectiveId, progress: userObjective.progress },
        'Objective progress updated'
      );
      return userObjective;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, objectiveId }, 'Failed to update objective progress');
      throw error;
    }
  });

  // POST /api/objectives/complete - Complete an objective and award coins
  fastify.post<{ Body: { objectiveId: string } }>('/api/objectives/complete', {
    schema: {
      description: 'Complete an objective and award coins',
      tags: ['objectives'],
      body: {
        type: 'object',
        required: ['objectiveId'],
        properties: {
          objectiveId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            userObjective: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                userId: { type: 'string' },
                objectiveId: { type: 'string', format: 'uuid' },
                progress: { type: 'integer' },
                completed: { type: 'boolean' },
                completedAt: { type: ['string', 'null'], format: 'date-time' },
              },
            },
            coinsAwarded: { type: 'integer' },
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
  }, async (request: FastifyRequest<{ Body: { objectiveId: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { objectiveId } = request.body;

    app.logger.info({ userId: session.user.id, objectiveId }, 'Completing objective');

    try {
      const objective = await app.db.query.dailyObjectives.findFirst({
        where: eq(schema.dailyObjectives.id, objectiveId),
      });

      if (!objective) {
        app.logger.warn({ objectiveId }, 'Objective not found');
        return reply.status(404).send({ error: 'Objective not found' });
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const userObjective = await app.db.query.userObjectives.findFirst({
        where: and(
          eq(schema.userObjectives.userId, session.user.id),
          eq(schema.userObjectives.objectiveId, objectiveId),
          gte(schema.userObjectives.date, today)
        ),
      });

      if (!userObjective) {
        app.logger.warn({ userId: session.user.id, objectiveId }, 'User objective not found');
        return reply.status(404).send({ error: 'User objective not found' });
      }

      if (userObjective.completed) {
        app.logger.warn({ userId: session.user.id, objectiveId }, 'Objective already completed');
        return reply.status(400).send({ error: 'Objective already completed' });
      }

      // Mark as completed
      const completed = await app.db.update(schema.userObjectives).set({
        completed: true,
        completedAt: new Date(),
      }).where(eq(schema.userObjectives.id, userObjective.id)).returning();

      // Award coins to user stats
      let userStats = await app.db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, session.user.id),
      });

      if (!userStats) {
        const created = await app.db.insert(schema.userStats).values({
          userId: session.user.id,
          totalCoins: objective.rewardCoins,
        }).returning();
        userStats = created[0];
      } else {
        await app.db.update(schema.userStats).set({
          totalCoins: userStats.totalCoins + objective.rewardCoins,
        }).where(eq(schema.userStats.userId, session.user.id));
      }

      app.logger.info(
        {
          userId: session.user.id,
          objectiveId,
          coinsAwarded: objective.rewardCoins,
        },
        'Objective completed and coins awarded'
      );

      return {
        userObjective: completed[0],
        coinsAwarded: objective.rewardCoins,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, objectiveId }, 'Failed to complete objective');
      throw error;
    }
  });
}
