import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerHealthRoutes } from "./health.js";

describe("registerHealthRoutes", () => {
  it("answers GET /health with an ok status", async () => {
    const app = Fastify();
    registerHealthRoutes(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "puck-api" });

    await app.close();
  });
});
