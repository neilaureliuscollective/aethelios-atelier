import { identitiesMatch, type OperationIdentity } from "@/lib/client/operationIdentity";
import { classifySubmitFailure } from "@/lib/client/submitCommand";

export function canCommitSubmitReadback(input: {
  captured: OperationIdentity;
  current: OperationIdentity | null;
  fence: {
    allowsStorageWrite: (captured: { ownerId: string; signOutEpoch: number }) => boolean;
    isCurrent: (generation: number, ownerId: string | null) => boolean;
  };
  disposed?: boolean;
  submitToken: number;
  currentToken: number;
}): boolean {
  if (input.disposed) return false;
  if (input.submitToken !== input.currentToken) return false;
  if (!identitiesMatch(input.captured, input.current)) return false;
  if (!input.fence.allowsStorageWrite(input.captured)) return false;
  if (!input.fence.isCurrent(input.captured.generation, input.captured.ownerId)) return false;
  return true;
}

/** GET 403/409/network after a successful POST is unverified, never a rejected command. */
export function classifyVerificationFailure(error: {
  status?: number;
  code?: string;
  message?: string;
}): "uncertain" {
  void classifySubmitFailure(error, "verify");
  return "uncertain";
}
