import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerStoreRoutes } from './routes/store.js';
import { registerLeaderboardRoutes } from './routes/leaderboard.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerObjectivesRoutes } from './routes/objectives.js';
import { seedObjectives } from './db/seed-objectives.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Seed objectives
app.logger.info('Seeding objectives...');
await seedObjectives(app);

// Register routes
registerStoreRoutes(app, app.fastify);
registerLeaderboardRoutes(app, app.fastify);
registerStatsRoutes(app, app.fastify);
registerObjectivesRoutes(app, app.fastify);

await app.run();
app.logger.info('Application running');
