export type ActionStatus = "idle" | "pending" | "error";

export function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
