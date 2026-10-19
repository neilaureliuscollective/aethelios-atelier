export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body?: unknown
  ) {
    super(message);
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
    throw new ApiError(data.message ?? "Request failed", response.status, data.error, data);
  }
  return data;
}
