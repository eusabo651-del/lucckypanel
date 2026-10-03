import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeResponse() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: "",
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(value: string) { this.body = value; },
  };
}

async function invokeAdminLogin(adminKey: string) {
  const handler = (await import("../api/trpc")).default;
  const res = makeResponse();
  await handler({
    url: "/api/trpc?path=auth.adminLogin",
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "Unit Test Browser" },
    body: { json: { adminKey } },
  }, res);
  return res;
}

describe("Vercel admin login", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RBXIS_ADMIN_KEY", "correct-admin-key");
    vi.stubEnv("DISCORD_ADMIN_LOGIN_WEBHOOK", "https://discord.com/api/webhooks/123/test-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("notifies Discord only for an incorrect admin key and never includes the submitted key", async () => {
    const res = await invokeAdminLogin("wrong-admin-key");
    const fetchMock = vi.mocked(globalThis.fetch);

    expect(res.statusCode).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/123/test-token");
    const payload = JSON.parse(String(init?.body));
    expect(payload.embeds[0].title).toContain("inválida");
    expect(JSON.stringify(payload)).toContain("203.0.113.7");
    expect(JSON.stringify(payload)).not.toContain("wrong-admin-key");
    expect(JSON.stringify(payload)).not.toContain("correct-admin-key");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });

  it("does not notify Discord when the admin key is correct", async () => {
    const res = await invokeAdminLogin("correct-admin-key");
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it("keeps login handling functional when the webhook environment variable is absent", async () => {
    vi.stubEnv("DISCORD_ADMIN_LOGIN_WEBHOOK", "");
    const res = await invokeAdminLogin("wrong-admin-key");
    expect(res.statusCode).toBe(401);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });
});
