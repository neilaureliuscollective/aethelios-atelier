import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { buildResponsesContinuation, CompanionTalk, describeCommittedWork } from "@/lib/cofounder/talk";
import { buildComposition, defaultLayers, paletteForProfile } from "@/lib/cofounder/composition";
import { FixtureImageProvider, CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWork } from "@/lib/cofounder/work";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { CompanionVoice } from "@/lib/cofounder/voice";
import { encodeSolidPng } from "@/lib/cofounder/png";
import { ConflictError, ForbiddenError, LimitError, UnconfiguredError } from "@/lib/domain/errors";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { AuthContext, User } from "@/lib/types";

const originalEnv = { ...process.env };
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function setup() {
  process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
  process.env.ATELIER_AUTH_ADAPTER = "simulated";
  process.env.ATELIER_OPENAI_ENABLED = "false";
  delete process.env.OPENAI_API_KEY;
  const store = new MemoryPersistence();
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
  const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
  const founder = (await store.getUserByEmail("neil.local@atelier.invalid")) as User;
  return {
    store,
    owner,
    other,
    founder,
    workspace: new CompanionWorkspace(store),
    work: new CompanionWork(store),
    talk: new CompanionTalk(store),
    usage: new CompanionUsage(store)
  };
}

function authFor(user: User): AuthContext {
  return {
    user,
    session: {
      id: `sess_${user.id}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    },
    adapter: "simulated"
  };
}

describe("owner experience authorization and persistence", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("lets founders read another business and blocks every mutation including memory accept", async () => {
    const { store, owner, other, founder, workspace, work } = await setup();
    const ownerCtx = await workspace.ensureForUser(owner);
    const founderView = await workspace.requireMembership(ownerCtx.business.id, founder);
    expect(founderView.membership.role).toBe("founder");
    await expect(workspace.requireMutable(ownerCtx.business.id, founder)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      workspace.updateProfile(ownerCtx.business.id, founder, {
        fields: { ...founderView.profile.fields, services: { key: "services", value: "Hijack", kind: "confirmed" } }
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const proposal = await workspace.proposeMemory(ownerCtx.business.id, owner, "audience", "Neighborhood families");
    await expect(workspace.resolveMemory(ownerCtx.business.id, founder, proposal.id, "accept")).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(work.saveDraft(ownerCtx.business.id, founder, { title: "No", body: "No" })).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(work.list(ownerCtx.business.id, other)).rejects.toBeInstanceOf(ForbiddenError);
    const studio = new CompanionStudio(store);
    await expect(
      studio.exportDraft(ownerCtx.business.id, founder, "missing", "square_announcement", { composedPngBase64: PNG })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("persists retry sessionId on memory updateJob and documents the SQLite/Postgres column write", async () => {
    const { store } = await setup();
    const created = await store.companion.addJob({
      id: "job_1",
      businessId: "biz_1",
      ownerId: "user_1",
      sessionId: "sess_old",
      kind: "talk",
      status: "failed",
      idempotencyKey: "talk-retry",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    expect(created.sessionId).toBe("sess_old");
    await store.companion.updateJob({
      ...created,
      status: "pending",
      sessionId: "sess_new",
      updatedAt: "2026-01-01T00:01:00.000Z"
    });
    expect((await store.companion.getJob("job_1"))?.sessionId).toBe("sess_new");
  });
});

describe("Talk continuation, cancellation, and session fencing", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("links function_call_output to the model call_id through previous_response_id", () => {
    const linked = buildResponsesContinuation({
      previousResponseId: "resp_1",
      callOutputs: [{ call_id: "call_9", output: "{\"ok\":true}" }]
    });
    expect(linked.previous_response_id).toBe("resp_1");
    expect(linked.input).toEqual([{ type: "function_call_output", call_id: "call_9", output: "{\"ok\":true}" }]);
  });

  it("continues a Responses tool hop and does not duplicate a retried save", async () => {
    const { store, owner, workspace, talk, work } = await setup();
    process.env.ATELIER_OPENAI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test-fixture";
    const ctx = await workspace.ensureForUser(owner);
    await store.createSession(authFor(owner).session);
    await workspace.updateProfile(ctx.business.id, owner, {
      fields: {
        ...ctx.profile.fields,
        name: { key: "name", value: "Cedar & Stone", kind: "confirmed" },
        services: { key: "services", value: "Custom timber porches", kind: "confirmed" }
      }
    });
    const calls: unknown[] = [];
    const live = talk.withModelClient({
      responses: {
        create: async (body) => {
          calls.push(body);
          const typed = body as { previous_response_id?: string; input?: Array<{ call_id?: string }> };
          if (!typed.previous_response_id) {
            return {
              id: "resp_1",
              output: [
                {
                  type: "function_call",
                  name: "save_draft",
                  call_id: "call_porch",
                  arguments: JSON.stringify({
                    title: "Spring porch openings",
                    body: "Cedar & Stone builds custom timber porches."
                  })
                }
              ]
            };
          }
          expect(typed.input?.[0]?.call_id).toBe("call_porch");
          return { id: "resp_2", output_text: "I proposed that announcement. Confirm it in Work.", output: [] };
        }
      }
    });
    const turn = await live.turn({
      businessId: ctx.business.id,
      user: owner,
      auth: authFor(owner),
      message: "Write a promotion using only our confirmed services.",
      idempotencyKey: "promo-live-1"
    });
    expect(turn.liveAi).toBe(true);
    expect(turn.proposedActions[0]?.preview).toContain("custom timber porches");
    expect(JSON.stringify(calls[1])).toContain("previous_response_id");
    const again = await live.turn({
      businessId: ctx.business.id,
      user: owner,
      auth: authFor(owner),
      message: "Write a promotion using only our confirmed services.",
      idempotencyKey: "promo-live-1"
    });
    expect(again.assistantMessage.id).toBe(turn.assistantMessage.id);
    const drafts = await work.list(ctx.business.id, owner);
    expect(drafts.filter((item) => item.title === "Spring porch openings")).toHaveLength(1);
  });

  it("stops before a tool, during a provider response, and after a committed result", async () => {
    const { store, owner, workspace, talk } = await setup();
    process.env.ATELIER_OPENAI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test-fixture";
    const ctx = await workspace.ensureForUser(owner);
    await store.createSession(authFor(owner).session);
    const before = new AbortController();
    before.abort();
    const early = await talk.withModelClient({
      responses: {
        create: async () => {
          throw new Error("provider should not run after stop");
        }
      }
    }).turn({
      businessId: ctx.business.id,
      user: owner,
      auth: authFor(owner),
      message: "Draft a porch promotion",
      signal: before.signal
    });
    expect(early.interrupted).toBe(true);
    expect(early.assistantMessage.body).toContain("Nothing extra was saved");

    const during = new AbortController();
    const mid = await talk.withModelClient({
      responses: {
        create: async (_body, opts) => {
          during.abort();
          if (opts?.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
          return { id: "resp_open", output_text: "should not finish", output: [] };
        }
      }
    }).turn({
      businessId: ctx.business.id,
      user: owner,
      auth: authFor(owner),
      message: "Keep talking",
      signal: during.signal
    });
    expect(mid.interrupted).toBe(true);

    let hops = 0;
    const after = new AbortController();
    const committed = await talk.withModelClient({
      responses: {
        create: async () => {
          hops += 1;
          if (hops === 1) {
            return {
              id: "resp_tool",
              output: [
                {
                  type: "function_call",
                  name: "save_draft",
                  call_id: "call_saved",
                  arguments: JSON.stringify({ title: "Committed draft", body: "Already saved as a proposal." })
                }
              ]
            };
          }
          after.abort();
          throw Object.assign(new Error("Aborted"), { name: "AbortError" });
        }
      }
    }).turn({
      businessId: ctx.business.id,
      user: owner,
      auth: authFor(owner),
      message: "Save this then stop",
      signal: after.signal
    });
    expect(committed.proposedActions[0]?.title).toBe("Committed draft");
    expect(committed.assistantMessage.body).not.toContain("Saved work is unchanged");
    expect(committed.assistantMessage.body.toLowerCase()).toContain("proposed");
    expect(describeCommittedWork(committed.toolsUsed, committed.proposedActions)).toContain("proposed");
  });

  it("refuses a tool after the session is gone so a late response cannot write another owner", async () => {
    const { store, owner, workspace, talk } = await setup();
    process.env.ATELIER_OPENAI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test-fixture";
    const ctx = await workspace.ensureForUser(owner);
    const auth = authFor(owner);
    await store.createSession(auth.session);
    const fenced = await talk.withModelClient({
      responses: {
        create: async () => {
          await store.deleteSession(auth.session.id);
          return {
            id: "resp_late",
            output: [
              {
                type: "function_call",
                name: "save_draft",
                call_id: "call_late",
                arguments: JSON.stringify({ title: "Late write", body: "Should not save" })
              }
            ]
          };
        }
      }
    }).turn({
      businessId: ctx.business.id,
      user: owner,
      auth,
      message: "Save after I sign out"
    });
    expect(fenced.liveAi).toBe(false);
    const items = await store.companion.listWorkItems(ctx.business.id);
    expect(items.some((item) => item.title === "Late write")).toBe(false);
  });
});

describe("usage reservations", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects the second last-allowance request with zero provider calls", async () => {
    const { store, owner, workspace } = await setup();
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "1";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "2";
    const ctx = await workspace.ensureForUser(owner);
    const session = authFor(owner);
    await store.createSession(session.session);
    let calls = 0;
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        calls += 1;
        return { bytes: new Uint8Array([1, 2, 3, 4]), mime: "image/png", model: "fixture" };
      },
      async edit() {
        calls += 1;
        return { bytes: new Uint8Array([1, 2, 3, 4]), mime: "image/png", model: "fixture" };
      }
    });
    const first = await studio.createFromCopy(ctx.business.id, owner, { headline: "One", body: "A" });
    const second = await studio.createFromCopy(ctx.business.id, owner, { headline: "Two", body: "B" });
    const results = await Promise.allSettled([
      studio.generate(ctx.business.id, owner, session, {
        draftId: first.draft.id,
        prompt: "one",
        idempotencyKey: "reserve-a"
      }),
      studio.generate(ctx.business.id, owner, session, {
        draftId: second.draft.id,
        prompt: "two",
        idempotencyKey: "reserve-b"
      })
    ]);
    const accepted = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === "rejected" && rejected[0].reason).toBeInstanceOf(LimitError);
    expect(calls).toBe(1);
    const usage = await new CompanionUsage(store).snapshot(ctx.business.id, owner);
    expect(usage.imagesUsed).toBe(1);
  });
});

describe("Studio import, drafts, logo, and export evidence", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("imports the exact selected copy and keeps a cleared body empty", async () => {
    const { store, owner, workspace, work } = await setup();
    const ctx = await workspace.ensureForUser(owner);
    const selected = await work.saveDraft(ctx.business.id, owner, {
      title: "Cedar evenings",
      body: "Custom timber porches for neighborhood homes."
    });
    const studio = new CompanionStudio(store);
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: selected.title,
      body: String(selected.payload.body),
      workItemId: selected.id
    });
    expect(created.draft.layers.find((layer) => layer.kind === "body")?.text).toBe(
      "Custom timber porches for neighborhood homes."
    );
    const cleared = await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layers: created.draft.layers.map((layer) => (layer.kind === "body" ? { ...layer, text: "" } : layer)),
      expectedUpdatedAt: created.draft.updatedAt
    });
    expect(cleared.layers.find((layer) => layer.kind === "body")?.text).toBe("");
    await expect(
      studio.updateDraft(ctx.business.id, owner, created.draft.id, {
        layers: cleared.layers,
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(cleared.updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("keeps logo composition in the shared spec and never marks a failed export", async () => {
    const { store, owner, workspace } = await setup();
    const ctx = await workspace.ensureForUser(owner);
    const studio = new CompanionStudio(store).withImageProvider(new FixtureImageProvider());
    await studio.uploadLogo(ctx.business.id, owner, {
      title: "Cedar mark",
      mime: "image/png",
      bytes: Uint8Array.from(Buffer.from(PNG, "base64"))
    });
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: "Porch season",
      body: "Custom timber porches.",
      layout: "portrait_social"
    });
    expect(created.draft.layers.some((layer) => layer.kind === "logo")).toBe(true);
    const spec = buildComposition({
      layout: "portrait_social",
      layers: created.draft.layers,
      businessId: ctx.business.id
    });
    expect(spec.logo?.src).toContain("/api/companion/documents/");
    expect(spec.width).toBe(1080);
    expect(spec.height).toBe(1350);
    expect(paletteForProfile(null).accent).not.toBe("#0b3d2e");
    const workBefore = await store.companion.getWorkItem(created.workItem.id);
    await expect(studio.exportDraft(ctx.business.id, owner, created.draft.id, "portrait_social")).rejects.toBeInstanceOf(
      ForbiddenError
    );
    expect((await store.companion.getWorkItem(created.workItem.id))?.status).toBe(workBefore?.status);
    expect((await store.companion.getWorkItem(created.workItem.id))?.status).not.toBe("exported");
    await expect(
      studio.exportDraft(ctx.business.id, owner, created.draft.id, "portrait_social", {
        composedPngBase64: PNG
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await store.companion.getWorkItem(created.workItem.id))?.status).not.toBe("exported");
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, "portrait_social", {
      composedPngBase64: Buffer.from(encodeSolidPng(1080, 1350)).toString("base64")
    });
    expect(exported.asset?.blobId).toBeTruthy();
    expect(exported.asset?.compositionRevisionId).toBe(exported.revision?.id);
    expect(exported.revision?.outputHash).toBeTruthy();
    const after = await store.companion.getWorkItem(created.workItem.id);
    expect(after?.status).toBe("exported");
    const bytes = await studio.getAssetBytes(ctx.business.id, owner, exported.asset!.id);
    expect(bytes.blob.bytes.byteLength).toBeGreaterThan(0);
    const layers = defaultLayers({ headline: "Porch season", body: "", layout: "website_banner" });
    expect(layers.find((layer) => layer.kind === "body")?.text).toBe("");
  });
});

describe("voice session lifecycle", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("stays unavailable without provider setup and does not invent a live session", async () => {
    const { owner, workspace, store } = await setup();
    const ctx = await workspace.ensureForUser(owner);
    await expect(
      new CompanionVoice(store).createWebRtcSession({
        businessId: ctx.business.id,
        user: owner,
        sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
      })
    ).rejects.toBeInstanceOf(UnconfiguredError);
  });

  it("reserves then releases when the handshake fails, and only claims workspaceBound after session config", async () => {
    const { owner, workspace, store, usage } = await setup();
    process.env.ATELIER_OPENAI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test-fixture";
    process.env.ATELIER_VOICE_COMMISSIONED = "true";
    const ctx = await workspace.ensureForUser(owner);
    const failing = new CompanionVoice(store, new CompanionWorkspace(store), usage, async () => {
      return new Response("no", { status: 503 });
    });
    await expect(
      failing.createWebRtcSession({
        businessId: ctx.business.id,
        user: owner,
        sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
      })
    ).rejects.toBeInstanceOf(UnconfiguredError);
    expect((await usage.snapshot(ctx.business.id, owner)).voiceMinutesUsed).toBe(0);

    const bound = new CompanionVoice(store, new CompanionWorkspace(store), usage, async (url, init) => {
      if (String(url).includes("/realtime/sessions") && !String(init?.body ?? "").includes("webrtc")) {
        return Response.json({ client_secret: { value: "secret_1" }, id: "sess_voice" });
      }
      if (String(url).includes("/realtime/calls")) {
        return new Response("v=0\r\nanswer", { status: 200 });
      }
      return new Response("no", { status: 404 });
    });
    const session = await bound.createWebRtcSession({
      businessId: ctx.business.id,
      user: owner,
      sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
    });
    expect(session.workspaceBound).toBe(true);
    expect(session.billedMinutes).toBe(0);
    expect(session.usageEventId).toBeTruthy();
    expect((await usage.snapshot(ctx.business.id, owner)).voiceMinutesUsed).toBe(0);
    const ended = await bound.endSession({
      businessId: ctx.business.id,
      user: owner,
      usageEventId: session.usageEventId,
      startedAt: new Date().toISOString()
    });
    expect(ended.billedMinutes).toBe(0);
    const again = await bound.endSession({
      businessId: ctx.business.id,
      user: owner,
      usageEventId: session.usageEventId,
      startedAt: new Date().toISOString()
    });
    expect(again.billedMinutes).toBe(0);
    expect((await usage.snapshot(ctx.business.id, owner)).voiceMinutesUsed).toBe(0);
  });

  it("keeps live voice gated when provider credentials exist but voice is not commissioned", async () => {
    process.env.ATELIER_OPENAI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test-fixture";
    delete process.env.ATELIER_VOICE_COMMISSIONED;
    const { owner, workspace, store } = await setup();
    const ctx = await workspace.ensureForUser(owner);
    await expect(
      new CompanionVoice(store).createWebRtcSession({
        businessId: ctx.business.id,
        user: owner,
        sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
      })
    ).rejects.toBeInstanceOf(UnconfiguredError);
  });
});
