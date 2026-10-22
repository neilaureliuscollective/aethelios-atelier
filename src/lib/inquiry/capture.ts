import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { hostedPlatformName } from "@/lib/runtime/hosted";
import type { StoredInquiry } from "@/lib/inquiry/types";

const captures = new Map<string, StoredInquiry>();

export function resetInquiryCapturesForTests() {
  captures.clear();
}

export function storeCapturedInquiry(inquiry: StoredInquiry) {
  captures.set(inquiry.id, inquiry);
}

export function listCapturedInquiries(): StoredInquiry[] {
  return [...captures.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function inquiryLogPath(dataDir: string) {
  return path.resolve(dataDir, "inquiries.jsonl");
}

export function appendInquiryLog(dataDir: string, inquiry: StoredInquiry, env: Record<string, string | undefined> = process.env) {
  if (hostedPlatformName(env)) return;
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(inquiryLogPath(dataDir), `${JSON.stringify(inquiry)}\n`, "utf8");
}

export function readInquiryLog(dataDir: string, limit = 50): StoredInquiry[] {
  try {
    const raw = readFileSync(inquiryLogPath(dataDir), "utf8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as StoredInquiry;
        } catch {
          return null;
        }
      })
      .filter((row): row is StoredInquiry => Boolean(row && row.id && row.createdAt));
    return rows.slice(-limit).reverse();
  } catch {
    return [];
  }
}
