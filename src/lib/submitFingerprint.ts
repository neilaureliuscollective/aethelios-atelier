import type { Brief } from "@/lib/types";

export function submitFingerprint(input: {
  projectId: string;
  ownerId: string;
  expectedVersion: number;
  brief: Brief;
}) {
  const canonical = JSON.stringify({
    projectId: input.projectId,
    ownerId: input.ownerId,
    expectedVersion: input.expectedVersion,
    brief: input.brief
  });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}_${canonical.length}`;
}
