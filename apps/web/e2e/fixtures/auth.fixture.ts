import { test as base } from "@playwright/test";

import {
  createTestUser,
  deleteTestUser,
  injectSession,
} from "../helpers/session";

interface AuthFixtures {
  authenticatedPage: { userId: string; email: string };
}

/**
 * Extends the base test with an `authenticatedPage` fixture that seeds a real
 * Supabase session (admin createUser → sign-in → cookie injection) and cleans
 * the user up afterwards. No OAuth flow needed.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ context }, use) => {
    const user = await createTestUser();
    // Once the user exists, cleanup must be unconditional: a throw from
    // injectSession would otherwise strand the user (and its trigger-created
    // user_profiles row) in the database on every run.
    try {
      await injectSession(context, user);
      await use({ userId: user.userId, email: user.email });
    } finally {
      await deleteTestUser(user.userId);
    }
  },
});

export { expect } from "@playwright/test";
