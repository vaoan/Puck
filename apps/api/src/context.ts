import { loadEnv, type Env } from "@puck/config";
import { createServiceClient, type PuckSupabaseClient } from "@puck/db";

/**
 * Shared, request-independent dependencies, built once at startup and handed
 * to the routes.
 *
 * The API is a thin intake layer: it writes follows and event changes to
 * Postgres. Fan-out and delivery happen asynchronously in the worker, driven
 * by a DB trigger (the outbox), so the API never blocks on sending and stays
 * fast regardless of how many followers an event has.
 */
export interface ApiContext {
  env: Env;
  client: PuckSupabaseClient;
}

export function createApiContext(): ApiContext {
  return {
    env: loadEnv(),
    client: createServiceClient(),
  };
}
