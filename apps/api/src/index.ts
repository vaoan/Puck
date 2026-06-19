import { createApiContext } from "./context.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const ctx = createApiContext();
  const app = await buildServer(ctx);

  await app.listen({ host: ctx.env.API_HOST, port: ctx.env.API_PORT });
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- nothing else is wired up yet at boot
  console.error("failed to start puck api", error);
  process.exitCode = 1;
});
