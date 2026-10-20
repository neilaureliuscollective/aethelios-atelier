export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Not found") {
    super(message, "not_found", 404);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Not authorized") {
    super(message, "forbidden", 403);
  }
}

export class ConflictError extends DomainError {
  constructor(
    message: string,
    readonly currentVersion?: number,
    readonly currentBrief?: unknown
  ) {
    super(message, "conflict", 409);
  }
}

export class UnconfiguredError extends DomainError {
  constructor(message: string) {
    super(message, "unconfigured", 503);
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = "Sign in is required for this action.") {
    super(message, "unauthenticated", 401);
  }
}

export class UncertainError extends DomainError {
  constructor(message: string) {
    super(message, "uncertain", 202);
  }
}

export class LimitError extends DomainError {
  constructor(message: string) {
    super(message, "limit", 429);
  }
}
