import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export function handleError(error: unknown) {
  if (error instanceof DomainError) {
    return json(
      {
        ok: false,
        error: error.code,
        message: error.message,
        currentVersion: "currentVersion" in error ? error.currentVersion : undefined,
        currentBrief: "currentBrief" in error ? error.currentBrief : undefined
      },
      error.status === 202 ? 409 : error.status
    );
  }
  console.error("atelier_unhandled", error instanceof Error ? error.name : "unknown");
  return json({ ok: false, error: "internal", message: "The request could not be completed." }, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
