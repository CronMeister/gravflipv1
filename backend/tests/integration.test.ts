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

  // ============ Store - Seed (Public) ============
  test("Seed store items", async () => {
    const res = await api("/api/store/seed", {
      method: "POST",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBeDefined();
    expect(data.count).toBeDefined();
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

  test("Get user purchases - unauthenticated", async () => {
    const res = await api("/api/store/purchases");
    await expectStatus(res, 401);
  });

  // ============ Store - Purchase (Authenticated) ============
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

  test("Purchase item - unauthenticated", async () => {
    const res = await api("/api/store/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "00000000-0000-0000-0000-000000000000" }),
    });
    await expectStatus(res, 401);
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

  // ============ Store - Equipped (Authenticated) ============
  test("Get user equipped items", async () => {
    const res = await authenticatedApi("/api/store/equipped", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.skin).toBeDefined();
    expect(data.trail).toBeDefined();
    expect(data.theme).toBeDefined();
    expect(data.gravity_effect).toBeDefined();
    expect(data.death_effect).toBeDefined();
  });

  test("Get user equipped items - unauthenticated", async () => {
    const res = await api("/api/store/equipped");
    await expectStatus(res, 401);
  });

  // ============ Store - Equip (Authenticated) ============
  test("Equip item - missing itemId", async () => {
    const res = await authenticatedApi("/api/store/equip", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: "skin" }),
    });
    await expectStatus(res, 400);
  });

  test("Equip item - missing slot", async () => {
    const res = await authenticatedApi("/api/store/equip", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "00000000-0000-0000-0000-000000000000" }),
    });
    await expectStatus(res, 400);
  });

  test("Equip item - invalid itemId format", async () => {
    const res = await authenticatedApi("/api/store/equip", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "invalid-uuid", slot: "skin" }),
    });
    await expectStatus(res, 400);
  });

  test("Equip item - invalid slot value", async () => {
    const res = await authenticatedApi("/api/store/equip", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "00000000-0000-0000-0000-000000000000",
        slot: "invalid-slot",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Equip item - nonexistent itemId", async () => {
    const res = await authenticatedApi("/api/store/equip", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "00000000-0000-0000-0000-000000000000",
        slot: "skin",
      }),
    });
    await expectStatus(res, 403);
  });

  test("Equip item - unauthenticated", async () => {
    const res = await api("/api/store/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "00000000-0000-0000-0000-000000000000",
        slot: "skin",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Equip item - valid", async () => {
    if (!itemId) {
      return;
    }
    const res = await authenticatedApi("/api/store/equip", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, slot: "skin" }),
    });
    await expectStatus(res, 200, 403);
  });

  // ============ Store - Daily Streak (Authenticated) ============
  test("Get daily streak", async () => {
    const res = await authenticatedApi("/api/store/daily-streak", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.currentStreak).toBeDefined();
    expect(data.canClaimToday).toBeDefined();
    expect(data.nextReward).toBeDefined();
  });

  test("Get daily streak - unauthenticated", async () => {
    const res = await api("/api/store/daily-streak");
    await expectStatus(res, 401);
  });

  // ============ Store - Claim Daily (Authenticated) ============
  test("Claim daily reward", async () => {
    const res = await authenticatedApi("/api/store/claim-daily", authToken, {
      method: "POST",
    });
    await expectStatus(res, 200, 400);
  });

  test("Claim daily reward - unauthenticated", async () => {
    const res = await api("/api/store/claim-daily", {
      method: "POST",
    });
    await expectStatus(res, 401);
  });

  // ============ Leaderboard - Weekly (Public) ============
  test("Get weekly leaderboard", async () => {
    const res = await api("/api/leaderboard/weekly");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // ============ Leaderboard - All-Time (Public) ============
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

  test("Get user leaderboard position - unauthenticated", async () => {
    const res = await api("/api/leaderboard/user");
    await expectStatus(res, 401);
  });

  // ============ Stats (Authenticated) ============
  test("Get user stats", async () => {
    const res = await authenticatedApi("/api/stats", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userId).toBeDefined();
    expect(data.highScore).toBeDefined();
  });

  test("Get user stats - unauthenticated", async () => {
    const res = await api("/api/stats");
    await expectStatus(res, 401);
  });

  test("Update score - missing score", async () => {
    const res = await authenticatedApi("/api/stats/score", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Update score - unauthenticated", async () => {
    const res = await api("/api/stats/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 100 }),
    });
    await expectStatus(res, 401);
  });

  test("Update score - valid", async () => {
    const res = await authenticatedApi("/api/stats/score", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 100 }),
    });
    await expectStatus(res, 200);
  });

  // ============ Objectives - Daily (Public) ============
  test("Get daily objectives", async () => {
    const res = await api("/api/objectives/daily");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      objectiveId = data[0].objective?.id;
    }
  });

  // ============ Objectives - Progress (Public) ============
  test("Update objective progress - no runScore", async () => {
    const res = await api("/api/objectives/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Update objective progress - with runScore", async () => {
    const res = await api("/api/objectives/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runScore: 500 }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
