import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;
  let objectiveId: string;
  let itemId: string;

  // ============ Auth Setup ============
  test("Sign up test user", async () => {
    const { token } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
  });

  // ============ Store - Items (Public) ============
  test("Get all store items", async () => {
    const res = await api("/api/store/items");
    await expectStatus(res, 200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      itemId = items[0].id;
    }
  });

  // ============ Store - Purchases (Authenticated) ============
  test("Get user purchases", async () => {
    const res = await authenticatedApi("/api/store/purchases", authToken);
    await expectStatus(res, 200);
    const purchases = await res.json();
    expect(Array.isArray(purchases)).toBe(true);
  });

  test("Purchase item - missing itemId", async () => {
    const res = await authenticatedApi("/api/store/purchase", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Purchase item - invalid itemId format", async () => {
    const res = await authenticatedApi("/api/store/purchase", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "invalid-uuid" }),
    });
    await expectStatus(res, 400);
  });

  test("Purchase item - nonexistent itemId", async () => {
    const res = await authenticatedApi("/api/store/purchase", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "00000000-0000-0000-0000-000000000000" }),
    });
    await expectStatus(res, 404);
  });

  test("Purchase item - valid", async () => {
    if (!itemId) {
      return;
    }
    const res = await authenticatedApi("/api/store/purchase", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    await expectStatus(res, 201);
  });

  // ============ Leaderboard - Public ============
  test("Get weekly leaderboard", async () => {
    const res = await api("/api/leaderboard/weekly");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get all-time leaderboard", async () => {
    const res = await api("/api/leaderboard/alltime");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // ============ Leaderboard - User (Authenticated) ============
  test("Get user leaderboard position", async () => {
    const res = await authenticatedApi("/api/leaderboard/user", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.weeklyRank).toBeDefined();
    expect(data.alltimeRank).toBeDefined();
  });

  // ============ Stats (Authenticated) ============
  test("Get user stats", async () => {
    const res = await authenticatedApi("/api/stats", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userId).toBeDefined();
    expect(data.highScore).toBeDefined();
  });

  test("Update score - missing score", async () => {
    const res = await authenticatedApi("/api/stats/score", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Update score - valid", async () => {
    const res = await authenticatedApi("/api/stats/score", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 100 }),
    });
    await expectStatus(res, 200);
  });

  // ============ Objectives (Authenticated) ============
  test("Get daily objectives", async () => {
    const res = await authenticatedApi("/api/objectives/daily", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      objectiveId = data[0].objective.id;
    }
  });

  test("Update objective progress - missing objectiveId", async () => {
    const res = await authenticatedApi("/api/objectives/progress", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: 10 }),
    });
    await expectStatus(res, 400);
  });

  test("Update objective progress - missing progress", async () => {
    if (!objectiveId) {
      return;
    }
    const res = await authenticatedApi("/api/objectives/progress", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveId }),
    });
    await expectStatus(res, 400);
  });

  test("Update objective progress - invalid objectiveId format", async () => {
    const res = await authenticatedApi("/api/objectives/progress", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectiveId: "invalid-uuid",
        progress: 10,
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update objective progress - nonexistent objectiveId", async () => {
    const res = await authenticatedApi("/api/objectives/progress", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectiveId: "00000000-0000-0000-0000-000000000000",
        progress: 10,
      }),
    });
    await expectStatus(res, 404);
  });

  test("Update objective progress - valid", async () => {
    if (!objectiveId) {
      return;
    }
    const res = await authenticatedApi("/api/objectives/progress", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveId, progress: 5 }),
    });
    await expectStatus(res, 200);
  });

  test("Complete objective - invalid objectiveId format", async () => {
    const res = await authenticatedApi("/api/objectives/complete", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectiveId: "invalid-uuid",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Complete objective - nonexistent objectiveId", async () => {
    const res = await authenticatedApi("/api/objectives/complete", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectiveId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Complete objective - valid", async () => {
    if (!objectiveId) {
      return;
    }
    const res = await authenticatedApi("/api/objectives/complete", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveId }),
    });
    await expectStatus(res, 200);
  });
});
