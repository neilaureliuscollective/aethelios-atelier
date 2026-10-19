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
  status: "pending" | "confirmed";
  receiptId?: string;
  submissionId?: string;
  confirmedAt?: string;
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
    createdAt: new Date().toISOString(),
    status: "pending"
  };
}

export function persistSubmitCommand(command: PendingSubmitCommand) {
  return writeOwnerJson(command.ownerId, "submit", command, command.projectId);
}

export function loadSubmitCommand(ownerId: string, projectId: string) {
  const command = readOwnerJson<PendingSubmitCommand>(ownerId, "submit", projectId);
  if (!command) return null;
  if (command.status === "confirmed") return null;
  return command;
}

export function loadConfirmedSubmit(ownerId: string, projectId: string) {
  const command = readOwnerJson<PendingSubmitCommand>(ownerId, "submit", projectId);
  if (command?.status === "confirmed") return command;
  return null;
}

export function archiveSubmitCommand(
  command: PendingSubmitCommand,
  receipt: { receiptId: string; submissionId: string }
) {
  return persistSubmitCommand({
    ...command,
    status: "confirmed",
    receiptId: receipt.receiptId,
    submissionId: receipt.submissionId,
    confirmedAt: new Date().toISOString()
  });
}
