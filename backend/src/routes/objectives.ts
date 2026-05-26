import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

export function registerObjectivesRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/objectives/daily - PUBLIC - Get all daily objectives with progress for device
  fastify.get('/api/objectives/daily', {
    schema: {
      description: "Get today's objectives with device progress (public)",
      tags: ['objectives'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              description: { type: 'string' },
              target_value: { type: 'integer' },
              reward_coins: { type: 'integer' },
              icon: { type: 'string' },
              kind: { type: 'string' },
              progress: { type: 'integer' },
              completed: { type: 'boolean' },
            },
          },
        },
      },
    },
    // Mark as public - no auth required
    config: { public: true } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = (request.headers['x-device-id'] as string) || '';
    app.logger.info({ deviceId }, 'Fetching daily objectives');

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const objectives = await app.db
        .select({
          id: schema.objectives.id,
          title: schema.objectives.title,
          description: schema.objectives.description,
          target_value: schema.objectives.target_value,
          reward_coins: schema.objectives.reward_coins,
          icon: schema.objectives.icon,
          kind: schema.objectives.kind,
          userProgress: schema.userObjectives.progress,
          userCompleted: schema.userObjectives.completed,
        })
        .from(schema.objectives)
        .leftJoin(
          schema.userObjectives,
          and(
            eq(schema.objectives.id, schema.userObjectives.objective_id),
            eq(schema.userObjectives.device_id, deviceId),
            gte(schema.userObjectives.date, today),
            lt(schema.userObjectives.date, tomorrow)
          )
        )
        .where(eq(schema.objectives.kind, 'daily'));

      const result = objectives.map((obj) => ({
        id: obj.id,
        title: obj.title,
        description: obj.description,
        target_value: obj.target_value,
        reward_coins: obj.reward_coins,
        icon: obj.icon,
        kind: obj.kind,
        progress: obj.userProgress ?? 0,
        completed: obj.userCompleted ?? false,
      }));

      app.logger.info({ deviceId, count: result.length }, 'Daily objectives fetched');
      return result;
    } catch (error) {
      app.logger.error({ err: error, deviceId }, 'Failed to fetch daily objectives');
      throw error;
    }
  });

  // GET /api/objectives/progress - PUBLIC - Get progress records for device
  fastify.get('/api/objectives/progress', {
    schema: {
      description: 'Get progress on objectives for device (public)',
      tags: ['objectives'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              objective_id: { type: 'string', format: 'uuid' },
              progress: { type: 'integer' },
              completed: { type: 'boolean' },
              completed_at: { type: ['string', 'null'], format: 'date-time' },
            },
          },
        },
      },
    },
    // Mark as public - no auth required
    config: { public: true } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = (request.headers['x-device-id'] as string) || '';
    app.logger.info({ deviceId }, 'Fetching objective progress');

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const progress = await app.db
        .select({
          objective_id: schema.userObjectives.objective_id,
          progress: schema.userObjectives.progress,
          completed: schema.userObjectives.completed,
          completed_at: schema.userObjectives.completed_at,
        })
        .from(schema.userObjectives)
        .where(
          and(
            eq(schema.userObjectives.device_id, deviceId),
            gte(schema.userObjectives.date, today),
            lt(schema.userObjectives.date, tomorrow)
          )
        );

      app.logger.info({ deviceId, count: progress.length }, 'Objective progress fetched');
      return progress;
    } catch (error) {
      app.logger.error({ err: error, deviceId }, 'Failed to fetch objective progress');
      throw error;
    }
  });

  // POST /api/objectives/complete - PUBLIC - Complete an objective
  fastify.post<{ Body: { objective_id: string; progress: number } }>('/api/objectives/complete', {
    schema: {
      description: 'Complete an objective (public)',
      tags: ['objectives'],
      body: {
        type: 'object',
        required: ['objective_id', 'progress'],
        properties: {
          objective_id: { type: 'string', format: 'uuid' },
          progress: { type: 'integer' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            completed: { type: 'boolean' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    // Mark as public - no auth required
    config: { public: true } as any,
  }, async (request: FastifyRequest<{ Body: { objective_id: string; progress: number } }>, reply: FastifyReply) => {
    const deviceId = (request.headers['x-device-id'] as string) || '';
    const { objective_id, progress } = request.body;

    app.logger.info({ deviceId, objective_id, progress }, 'Completing objective');

    try {
      const objective = await app.db.query.objectives.findFirst({
        where: eq(schema.objectives.id, objective_id),
      });

      if (!objective) {
        app.logger.warn({ objective_id }, 'Objective not found');
        return reply.status(400).send({ error: 'Objective not found' });
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const userObjective = await app.db.query.userObjectives.findFirst({
        where: and(
          eq(schema.userObjectives.objective_id, objective_id),
          eq(schema.userObjectives.device_id, deviceId),
          gte(schema.userObjectives.date, today)
        ),
      });

      const isCompleted = progress >= objective.target_value;

      if (userObjective) {
        await app.db.update(schema.userObjectives).set({
          progress,
          completed: isCompleted,
          completed_at: isCompleted ? new Date() : null,
        }).where(eq(schema.userObjectives.id, userObjective.id));
      } else {
        await app.db.insert(schema.userObjectives).values({
          objective_id,
          device_id: deviceId,
          progress,
          completed: isCompleted,
          completed_at: isCompleted ? new Date() : null,
          date: today,
        });
      }

      app.logger.info(
        { deviceId, objective_id, progress, completed: isCompleted },
        'Objective completed'
      );

      return { success: true, completed: isCompleted };
    } catch (error) {
      app.logger.error({ err: error, deviceId, objective_id }, 'Failed to complete objective');
      throw error;
    }
  });
}
