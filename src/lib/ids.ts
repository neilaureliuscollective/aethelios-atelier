import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export function createId(prefix?: string) {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function createReceiptId() {
  return `rcpt_${randomBytes(9).toString("hex")}`;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
