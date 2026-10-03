import { describe, expect, it, vi } from "vitest";
import { createMockKey, listMockKeys, mockKeyToLicense } from "./mockapi";
import { activationExpirySeconds } from "../shared/rbxis";

describe("MockAPI key expiration", () => {
  it("expires an hourly key exactly one hour after activation", () => {
    const activatedAt = 1_800_000_000;
    expect(activationExpirySeconds("hourly", 1, activatedAt)).toBe(activatedAt + 3_600);
  });

  it("keeps permanent keys without an expiry timestamp", () => {
    expect(activationExpirySeconds("perm", 0, 1_800_000_000)).toBe(0);
  });

  it("maps the hourly type to a one-hour duration", () => {
    const license = mockKeyToLicense({ key: "LUCK-hourly-test", used: false, device: "", expire: 1, type: "hourly", createdAt: 1_800_000_000, activatedAt: 0, expiresAt: 0 });
    expect(license.planId).toBe("hourly");
    expect(license.durationValue).toBe(1);
    expect(license.durationUnit).toBe("hours");
  });

  it("posts an hourly key using the existing MockAPI fields", async () => {
    let posted: Record<string, unknown> | undefined;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      posted = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: "hourly-test-1", ...posted }), { status: 201, headers: { "content-type": "application/json" } });
    });
    try {
      const key = await createMockKey({ username: "hour_test", planId: "hourly", durationValue: 1, durationUnit: "hours" });
      expect(key.type).toBe("hourly");
      expect(posted).toMatchObject({ username: "hour_test", type: "hourly", expire: 1, used: false, activatedAt: 0, expiresAt: 0, status: "active" });
      expect(posted).not.toHaveProperty("durationUnit");
    } finally {
      fetch.mockRestore();
    }
  });
});

describe("MockAPI keys integration", () => {
  it("reads the configured keys collection", async () => {
    const keys = await listMockKeys();
    expect(Array.isArray(keys)).toBe(true);
  });
});
