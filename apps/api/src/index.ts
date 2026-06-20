import { createApiContext } from "./context.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const ctx = createApiContext();
  const app = await buildServer(ctx);

  await app.listen({ host: ctx.env.API_HOST, port: ctx.env.API_PORT });
}

try {
  await main();
} catch (error) {
  console.error("failed to start puck api", error);
  process.exitCode = 1;
}
