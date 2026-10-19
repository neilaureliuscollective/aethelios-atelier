import { readOwnerJson, writeOwnerJson } from "@/lib/client/ownerScope";
import { submitFingerprint } from "@/lib/submitFingerprint";
import type { Brief } from "@/lib/types";

export type PendingSubmitCommand = {
  idempotencyKey: string;
  projectId: string;
  ownerId: string;
  expectedVersion: number;
  payloadHash: string;
  consentText: string;
  createdAt: string;
};

export function buildSubmitCommand(input: {
  idempotencyKey: string;
  projectId: string;
  ownerId: string;
  expectedVersion: number;
  brief: Brief;
  consentText: string;
}): PendingSubmitCommand {
  return {
    idempotencyKey: input.idempotencyKey,
    projectId: input.projectId,
    ownerId: input.ownerId,
    expectedVersion: input.expectedVersion,
    payloadHash: submitFingerprint(input),
    consentText: input.consentText,
    createdAt: new Date().toISOString()
  };
}

export function persistSubmitCommand(command: PendingSubmitCommand) {
  return writeOwnerJson(command.ownerId, "submit", command, command.projectId);
}

export function loadSubmitCommand(ownerId: string, projectId: string) {
  return readOwnerJson<PendingSubmitCommand>(ownerId, "submit", projectId);
}
