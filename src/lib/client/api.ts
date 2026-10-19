export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body?: unknown
  ) {
    super(message);
  }

  get currentVersion() {
    const payload = this.body as { currentVersion?: number } | undefined;
    return typeof payload?.currentVersion === "number" ? payload.currentVersion : undefined;
  }

  get currentBrief() {
    const payload = this.body as { currentBrief?: unknown } | undefined;
    return payload?.currentBrief;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  } & T;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("atelier:session-expired"));
    }
    throw new ApiError(data.message ?? "Request failed", response.status, data.error, data);
  }
  return data;
}
