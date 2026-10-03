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

async function invoke(path: string, input: Record<string, unknown>, cookie = "") {
  const handler = (await import("../api/trpc")).default;
  const res = makeResponse();
  const headers: Record<string, string> = { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "Unit Test Browser" };
  if (cookie) headers.cookie = cookie.split(";")[0];
  await handler({
    url: `/api/trpc?path=${encodeURIComponent(path)}`,
    method: "POST",
    headers,
    body: { json: input },
  }, res);
  return res;
}

function responseData(response: ReturnType<typeof makeResponse>) {
  return JSON.parse(response.body).result.data.json;
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
    const res = await invoke("auth.adminLogin", { adminKey: "wrong-admin-key" });
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
    const res = await invoke("auth.adminLogin", { adminKey: "correct-admin-key" });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it("keeps login handling functional when the webhook environment variable is absent", async () => {
    vi.stubEnv("DISCORD_ADMIN_LOGIN_WEBHOOK", "");
    const res = await invoke("auth.adminLogin", { adminKey: "wrong-admin-key" });
    expect(res.statusCode).toBe(401);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it("reports activation only on the first successful user login", async () => {
    let row: Record<string, unknown> = { id: "101", key: "LUCK-hourly-test", username: "test", used: false, device: "", expire: 1, type: "hourly", createdAt: 1_800_000_000, activatedAt: 0, expiresAt: 0, status: "active" };
    vi.stubGlobal("fetch", vi.fn(async (_input, init) => {
      if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify([row]), { status: 200, headers: { "content-type": "application/json" } });
      if (init?.method === "PUT") {
        row = { ...row, ...JSON.parse(String(init.body)) };
        return new Response(JSON.stringify(row), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected MockAPI method: ${init?.method}`);
    }));

    const first = await invoke("auth.login", { accessKey: "LUCK-hourly-test", deviceId: "device-1234" });
    const second = await invoke("auth.login", { accessKey: "LUCK-hourly-test", deviceId: "device-1234" });
    expect(first.statusCode).toBe(200);
    expect(responseData(first).activatedNow).toBe(true);
    expect(second.statusCode).toBe(200);
    expect(responseData(second).activatedNow).toBe(false);
  });

  it("deletes every MockAPI key only through the authenticated resetAll procedure", async () => {
    let rows: Record<string, unknown>[] = [
      { id: "201", key: "LUCK-daily-one", used: false, device: "", expire: 1, type: "daily", createdAt: 1, activatedAt: 0, expiresAt: 0, status: "active" },
      { id: "202", key: "LUCK-weekly-two", used: true, device: "hwid", expire: 7, type: "weekly", createdAt: 2, activatedAt: 2, expiresAt: 3, status: "active" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
      if (method === "DELETE") {
        const id = new URL(String(input)).pathname.split("/").pop();
        rows = rows.filter(row => row.id !== id);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected MockAPI method: ${method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const login = await invoke("auth.adminLogin", { adminKey: "correct-admin-key" });
    const reset = await invoke("admin.resetAll", { confirm: true }, login.headers["Set-Cookie"]);
    expect(login.statusCode).toBe(200);
    expect(reset.statusCode).toBe(200);
    expect(responseData(reset)).toEqual({ success: true, count: 2 });
    expect(rows).toEqual([]);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(2);
  });
});
