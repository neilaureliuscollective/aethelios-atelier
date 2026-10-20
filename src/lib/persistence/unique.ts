import { UniqueConstraintError } from "@/lib/domain/errors";

export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof UniqueConstraintError) return true;
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "23505" ||
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "SQLITE_CONSTRAINT" ||
    /UNIQUE constraint failed/i.test(message) ||
    /duplicate key value/i.test(message)
  );
}

export function throwIfUnique(error: unknown, message: string): never {
  if (isUniqueViolation(error)) {
    throw new UniqueConstraintError(message);
  }
  throw error;
}

export async function runWithUniqueRetry<T>(
  run: () => Promise<T>,
  options?: { attempts?: number; onExhausted?: (error: unknown) => never }
): Promise<T> {
  const attempts = options?.attempts ?? 4;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (!isUniqueViolation(error) || attempt === attempts - 1) {
        if (isUniqueViolation(error) && options?.onExhausted) {
          options.onExhausted(error);
        }
        throw error;
      }
    }
  }
  throw last;
}
