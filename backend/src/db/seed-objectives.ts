import { sql } from 'drizzle-orm';
import type { App } from '../index.js';

export async function seedObjectives(app: App) {
  // Generate seed data for all three kinds
  const seedData: Array<{
    code: string;
    title: string;
    description: string;
    target_value: number;
    reward_coins: number;
    icon: string;
    kind: string;
  }> = [];

  // score_in_run: 50 objectives, codes score_in_run_1 through score_in_run_50
  const scoreInRunTargets = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  for (let i = 1; i <= 50; i++) {
    const targetValue = scoreInRunTargets[(i - 1) % scoreInRunTargets.length];
    seedData.push({
      code: `score_in_run_${i}`,
      title: `Score ${targetValue} in a run`,
      description: `Reach a score of ${targetValue} in a single run`,
      target_value: targetValue,
      reward_coins: Math.floor(targetValue / 5),
      icon: '🎯',
      kind: 'score_in_run',
    });
  }

  // score_total_today: 50 objectives, codes score_total_today_1 through score_total_today_50
  const scoreTotalTargets = [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
  for (let i = 1; i <= 50; i++) {
    const targetValue = scoreTotalTargets[(i - 1) % scoreTotalTargets.length];
    seedData.push({
      code: `score_total_today_${i}`,
      title: `Score ${targetValue} today`,
      description: `Accumulate a total score of ${targetValue} today`,
      target_value: targetValue,
      reward_coins: Math.floor(targetValue / 10),
      icon: '📊',
      kind: 'score_total_today',
    });
  }

  // runs_today: 50 objectives, codes runs_today_1 through runs_today_50
  const runsTargets = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50];
  for (let i = 1; i <= 50; i++) {
    const targetValue = runsTargets[(i - 1) % runsTargets.length];
    seedData.push({
      code: `runs_today_${i}`,
      title: `Play ${targetValue} run${targetValue !== 1 ? 's' : ''} today`,
      description: `Complete ${targetValue} run${targetValue !== 1 ? 's' : ''} today`,
      target_value: targetValue,
      reward_coins: targetValue * 3,
      icon: '🏃',
      kind: 'runs_today',
    });
  }

  try {
    // Extract codes for deletion
    const codes = seedData.map((item) => `'${item.code.replace(/'/g, "''")}'`).join(',');

    // Delete existing objectives with these codes (idempotent)
    await app.db.execute(sql.raw(`
      DELETE FROM objectives WHERE code IN (${codes})
    `));

    // Build VALUES clause with escaped strings
    const valueStrings = seedData
      .map((item) => {
        const code = item.code.replace(/'/g, "''");
        const title = item.title.replace(/'/g, "''");
        const description = item.description.replace(/'/g, "''");
        return `(gen_random_uuid(), '${code}', '${title}', '${description}', ${item.target_value}, ${item.reward_coins}, '${item.icon}', '${item.kind}', NOW())`;
      })
      .join(',');

    // Insert all objectives
    await app.db.execute(sql.raw(`
      INSERT INTO objectives (id, code, title, description, target_value, reward_coins, icon, kind, created_at)
      VALUES ${valueStrings}
    `));
    app.logger.info({ count: seedData.length }, 'Objectives seeded');
  } catch (error) {
    app.logger.error({ err: error }, 'Error seeding objectives');
    throw error;
  }
}
