import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAtelierAuthAdapter } from "@/lib/auth/adapter";
import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import { displayNameFromEmail, resolveRole } from "@/lib/auth/roles";
import { createEmptyBrief } from "@/lib/brief";
import { AuthenticationError, ForbiddenError } from "@/lib/domain/errors";
import { ProjectService } from "@/lib/domain/projects";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { AdapterUser } from "next-auth/adapters";
import type { User } from "@/lib/types";

const SECRET = "atelier-authjs-test-secret-value-32ch";

function authjsEnv() {
  process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
  process.env.ATELIER_AUTH_ADAPTER = "authjs";
  process.env.AUTH_SECRET = SECRET;
  process.env.ATELIER_SESSION_SECRET = SECRET;
  process.env.ATELIER_AUTH_EMAIL_CAPTURE = "true";
  process.env.ATELIER_FOUNDER_EMAILS = "founder.auth@atelier.invalid";
  process.env.ATELIER_OPENAI_ENABLED = "false";
  delete process.env.VERCEL;
  delete process.env.AUTH_GOOGLE_ID;
  delete process.env.AUTH_RESEND_KEY;
}

async function createAuthUser(
  adapter: ReturnType<typeof createAtelierAuthAdapter>,
  email: string,
  name?: string
) {
  const user = await adapter.createUser?.({
    id: undefined as unknown as string,
    email,
    name: name ?? null,
    emailVerified: new Date(),
    image: null
  } as AdapterUser);
  return user as AdapterUser;
}

describe("Auth.js identity mapping and authorization", () => {
  const original = { ...process.env };

  beforeEach(() => {
    authjsEnv();
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("assigns founder only from the server email list and keeps callbacks on-site", () => {
    expect(resolveRole("founder.auth@atelier.invalid", ["founder.auth@atelier.invalid"])).toBe("founder");
    expect(resolveRole("client.a@example.com", ["founder.auth@atelier.invalid"])).toBe("client");
    expect(displayNameFromEmail("client.a@example.com")).toBe("Client A");
    expect(safeCallbackUrl("/account/adopt")).toBe("/account/adopt");
    expect(safeCallbackUrl("/companion/confirm")).toBe("/companion/confirm");
    expect(safeCallbackUrl("/workspace/proj_1")).toBe("/workspace/proj_1");
    expect(safeCallbackUrl("https://evil.example")).toBe("/account");
    expect(safeCallbackUrl("//evil.example")).toBe("/account");
    expect(safeCallbackUrl("/\\evil")).toBe("/account");
    expect(safeCallbackUrl("/api/session")).toBe("/account");
    expect(safeCallbackUrl("/unknown-private")).toBe("/account");
  });

  it("keeps two real client accounts isolated and authorizes founder through the existing project API", async () => {
    const store = new MemoryPersistence();
    const adapter = createAtelierAuthAdapter(store);
    const first = await createAuthUser(adapter, "client.a@example.com", "Client A");
    const second = await createAuthUser(adapter, "client.b@example.com", "Client B");
    const founder = await createAuthUser(adapter, "founder.auth@atelier.invalid", "Neil");
    const service = new ProjectService(store);
    const owner = (await store.getUserById(first.id)) as User;
    const other = (await store.getUserById(second.id)) as User;
    const neil = (await store.getUserById(founder.id)) as User;

    expect(owner.adapter).toBe("authjs");
    expect(other.adapter).toBe("authjs");
    expect(neil.role).toBe("founder");
    expect(owner.role).toBe("client");

    const project = await service.createProject(owner, createEmptyBrief());
    await expect(service.clientView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.founderQueue(owner)).rejects.toBeInstanceOf(ForbiddenError);
    const queue = await service.founderQueue(neil);
    expect(queue).toEqual([]);

    await service.submit(project.id, owner, true, "authjs-submit", project.version);
    const afterSubmit = await service.founderQueue(neil);
    expect(afterSubmit).toHaveLength(1);
    expect(afterSubmit[0]?.id).toBe(project.id);
    await expect(service.founderView(project.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    const founderView = await service.founderView(project.id, neil);
    expect(founderView.owner.email).toBe("client.a@example.com");
    expect(founderView.project.ownerId).toBe(owner.id);
  });

  it("expires database sessions and does not reuse a consumed magic-link token", async () => {
    const store = new MemoryPersistence();
    const adapter = createAtelierAuthAdapter(store);
    const created = await createAuthUser(adapter, "client.a@example.com");
    const expired = await adapter.createSession?.({
      sessionToken: "sess_expired",
      userId: created.id,
      expires: new Date(Date.now() - 1000)
    });
    expect(expired?.sessionToken).toBe("sess_expired");
    const live = await adapter.createSession?.({
      sessionToken: "sess_live",
      userId: created.id,
      expires: new Date(Date.now() + 60_000)
    });
    expect((await adapter.getSessionAndUser?.("sess_expired")) ?? null).toBeNull();
    expect((await adapter.getSessionAndUser?.("sess_live"))?.user.email).toBe("client.a@example.com");
    expect(live?.userId).toBe(created.id);

    await adapter.createVerificationToken?.({
      identifier: "client.a@example.com",
      token: "hash-1",
      expires: new Date(Date.now() + 60_000)
    });
    const used = await adapter.useVerificationToken?.({
      identifier: "client.a@example.com",
      token: "hash-1"
    });
    expect(used?.token).toBe("hash-1");
    expect(
      await adapter.useVerificationToken?.({ identifier: "client.a@example.com", token: "hash-1" })
    ).toBeNull();
  });

  it("recomputes founder authorization from the current allow-list, not a stored claim", async () => {
    const store = new MemoryPersistence();
    const adapter = createAtelierAuthAdapter(store);
    const created = await createAuthUser(adapter, "promoted@example.com");
    expect((await store.getUserById(created.id))?.role).toBe("client");
    process.env.ATELIER_FOUNDER_EMAILS = "promoted@example.com";
    const promoted = await adapter.updateUser?.({ id: created.id, email: "promoted@example.com" });
    expect(promoted?.email).toBe("promoted@example.com");
    expect((await store.getUserById(created.id))?.role).toBe("founder");
  });
});

describe("authentication error contract", () => {
  it("uses 401 for a missing session and 503 for an unconfigured adapter", () => {
    const missing = new AuthenticationError();
    expect(missing.status).toBe(401);
    expect(missing.code).toBe("unauthenticated");
  });
});
