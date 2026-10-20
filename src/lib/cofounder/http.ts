import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { getStore } from "@/lib/persistence/store";

export const businessIdSchema = z.string().min(1).max(80).optional();

export async function requireCompanion(requestedBusinessId?: string) {
  const auth = await requireSession();
  const store = await getStore();
  const workspace = new CompanionWorkspace(store);
  const context = await workspace.ensureForUser(auth.user, requestedBusinessId);
  return { auth, store, workspace, context };
}
