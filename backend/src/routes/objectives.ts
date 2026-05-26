import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function seedObjectivesForDevice(
  app: App,
  deviceId: string,
  todayUtc: string
): Promise<void> {
  const kinds = ['score_in_run', 'score_total_today', 'runs_today'];

  for (const kind of kinds) {
    const objectives = await app.db
      .select({ id: schema.objectives.id })
      .from(schema.objectives)
      .where(eq(schema.objectives.kind, kind))
      .orderBy(schema.objectives.id);

    if (objectives.length === 0) continue;

    const hash = simpleHash(deviceId + todayUtc + kind);
    const index = hash % objectives.length;
    const selectedObjective = objectives[index];

    // Check if this objective already exists for this device/date
    const existing = await app.db.query.userObjectives.findFirst({
      where: and(
        eq(schema.userObjectives.device_id, deviceId),
        eq(schema.userObjectives.objective_id, selectedObjective.id),
        eq(schema.userObjectives.date_utc, todayUtc)
      ),
    });

    if (existing) {
      continue;
    }

    await app.db
      .insert(schema.userObjectives)
      .values({
        id: crypto.randomUUID(),
        objective_id: selectedObjective.id,
        device_id: deviceId,
        progress: 0,
        completed: false,
        date: new Date(),
        date_utc: todayUtc,
        created_at: new Date(),
      });
  }
}

export function registerObjectivesRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/objectives/daily - PUBLIC - Get today's 3 daily objectives with progress
  fastify.get('/api/objectives/daily', {
    schema: {
      description: 'Get today\'s 3 daily objectives with device progress (public)',
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
                  kind: { type: 'string' },
                },
              },
              progress: { type: 'integer' },
              completed: { type: 'boolean' },
            },
          },
        },
      },
    },
    config: { public: true } as any,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    let deviceId = (request.headers['x-device-id'] as string) || '';
    if (!deviceId) {
      deviceId = `test-device-${Date.now()}`;
    }

    const todayUtc = getTodayUtc();
    app.logger.info({ deviceId, todayUtc }, 'Fetching daily objectives');

    try {
      let rows = await app.db
        .select({
          id: schema.objectives.id,
          title: schema.objectives.title,
          description: schema.objectives.description,
          target_value: schema.objectives.target_value,
          reward_coins: schema.objectives.reward_coins,
          icon: schema.objectives.icon,
          kind: schema.objectives.kind,
          progress: schema.userObjectives.progress,
          completed: schema.userObjectives.completed,
        })
        .from(schema.userObjectives)
        .leftJoin(
          schema.objectives,
          eq(schema.userObjectives.objective_id, schema.objectives.id)
        )
        .where(
          and(
            eq(schema.userObjectives.device_id, deviceId),
            eq(schema.userObjectives.date_utc, todayUtc)
          )
        );

      if (rows.length === 0) {
        app.logger.info({ deviceId, todayUtc }, 'No objectives for today, seeding...');
        await seedObjectivesForDevice(app, deviceId, todayUtc);
        rows = await app.db
          .select({
            id: schema.objectives.id,
            title: schema.objectives.title,
            description: schema.objectives.description,
            target_value: schema.objectives.target_value,
            reward_coins: schema.objectives.reward_coins,
            icon: schema.objectives.icon,
            kind: schema.objectives.kind,
            progress: schema.userObjectives.progress,
            completed: schema.userObjectives.completed,
          })
          .from(schema.userObjectives)
          .leftJoin(
            schema.objectives,
            eq(schema.userObjectives.objective_id, schema.objectives.id)
          )
          .where(
            and(
              eq(schema.userObjectives.device_id, deviceId),
              eq(schema.userObjectives.date_utc, todayUtc)
            )
          );
      }

      const result = rows.map((row) => ({
        objective: {
          id: row.id,
          title: row.title,
          description: row.description,
          targetValue: row.target_value,
          rewardCoins: row.reward_coins,
          icon: row.icon,
          kind: row.kind,
        },
        progress: row.progress ?? 0,
        completed: row.completed ?? false,
      }));

      app.logger.info({ deviceId, count: result.length }, 'Daily objectives fetched');
      return result;
    } catch (error) {
      app.logger.error({ err: error, deviceId }, 'Failed to fetch daily objectives');
      throw error;
    }
  });

  // POST /api/objectives/progress - PUBLIC - Update progress from a run
  fastify.post<{ Body: { runScore?: number } }>('/api/objectives/progress', {
    schema: {
      description: 'Update objective progress from a run (public)',
      tags: ['objectives'],
      body: {
        type: 'object',
        properties: {
          runScore: { type: 'integer', description: 'Score from this run' },
        },
      },
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
                  kind: { type: 'string' },
                },
              },
              progress: { type: 'integer' },
              completed: { type: 'boolean' },
            },
          },
        },
      },
    },
    config: { public: true } as any,
  }, async (request: FastifyRequest<{ Body: { runScore?: number } }>, reply: FastifyReply) => {
    let deviceId = (request.headers['x-device-id'] as string) || '';
    if (!deviceId) {
      deviceId = `test-device-${Date.now()}`;
    }

    const runScore = request.body.runScore ?? 0;
    const todayUtc = getTodayUtc();
    app.logger.info({ deviceId, runScore, todayUtc }, 'Updating objective progress');

    try {
      let rows = await app.db
        .select({
          userObjId: schema.userObjectives.id,
          objectiveId: schema.objectives.id,
          title: schema.objectives.title,
          description: schema.objectives.description,
          target_value: schema.objectives.target_value,
          reward_coins: schema.objectives.reward_coins,
          icon: schema.objectives.icon,
          kind: schema.objectives.kind,
          progress: schema.userObjectives.progress,
          completed: schema.userObjectives.completed,
          completed_at: schema.userObjectives.completed_at,
        })
        .from(schema.userObjectives)
        .leftJoin(
          schema.objectives,
          eq(schema.userObjectives.objective_id, schema.objectives.id)
        )
        .where(
          and(
            eq(schema.userObjectives.device_id, deviceId),
            eq(schema.userObjectives.date_utc, todayUtc)
          )
        );

      if (rows.length === 0) {
        app.logger.info({ deviceId, todayUtc }, 'No objectives for today, seeding...');
        await seedObjectivesForDevice(app, deviceId, todayUtc);
        rows = await app.db
          .select({
            userObjId: schema.userObjectives.id,
            objectiveId: schema.objectives.id,
            title: schema.objectives.title,
            description: schema.objectives.description,
            target_value: schema.objectives.target_value,
            reward_coins: schema.objectives.reward_coins,
            icon: schema.objectives.icon,
            kind: schema.objectives.kind,
            progress: schema.userObjectives.progress,
            completed: schema.userObjectives.completed,
            completed_at: schema.userObjectives.completed_at,
          })
          .from(schema.userObjectives)
          .leftJoin(
            schema.objectives,
            eq(schema.userObjectives.objective_id, schema.objectives.id)
          )
          .where(
            and(
              eq(schema.userObjectives.device_id, deviceId),
              eq(schema.userObjectives.date_utc, todayUtc)
            )
          );
      }

      // Update each objective's progress based on kind
      for (const row of rows) {
        let newProgress = row.progress ?? 0;

        if (row.kind === 'score_in_run') {
          newProgress = runScore;
        } else if (row.kind === 'score_total_today') {
          newProgress = (row.progress ?? 0) + runScore;
        } else if (row.kind === 'runs_today') {
          newProgress = (row.progress ?? 0) + 1;
        }

        newProgress = Math.min(newProgress, row.target_value);
        const isCompleted = newProgress >= row.target_value;
        const wasCompleted = row.completed ?? false;

        await app.db
          .update(schema.userObjectives)
          .set({
            progress: newProgress,
            completed: isCompleted,
            completed_at: isCompleted && !wasCompleted ? new Date() : row.completed_at,
          })
          .where(eq(schema.userObjectives.id, row.userObjId));
      }

      // Re-fetch updated data
      const updated = await app.db
        .select({
          id: schema.objectives.id,
          title: schema.objectives.title,
          description: schema.objectives.description,
          target_value: schema.objectives.target_value,
          reward_coins: schema.objectives.reward_coins,
          icon: schema.objectives.icon,
          kind: schema.objectives.kind,
          progress: schema.userObjectives.progress,
          completed: schema.userObjectives.completed,
        })
        .from(schema.userObjectives)
        .leftJoin(
          schema.objectives,
          eq(schema.userObjectives.objective_id, schema.objectives.id)
        )
        .where(
          and(
            eq(schema.userObjectives.device_id, deviceId),
            eq(schema.userObjectives.date_utc, todayUtc)
          )
        );

      const result = updated.map((row) => ({
        objective: {
          id: row.id,
          title: row.title,
          description: row.description,
          targetValue: row.target_value,
          rewardCoins: row.reward_coins,
          icon: row.icon,
          kind: row.kind,
        },
        progress: row.progress ?? 0,
        completed: row.completed ?? false,
      }));

      app.logger.info({ deviceId, count: result.length }, 'Objective progress updated');
      return result;
    } catch (error) {
      app.logger.error({ err: error, deviceId }, 'Failed to update objective progress');
      throw error;
    }
  });
}
