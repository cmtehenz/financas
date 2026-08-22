export class UnauthorizedError extends Error {
  constructor(message = "UNAUTHENTICATED") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function assertSession<T>(session: T | null | undefined): asserts session is T {
  if (!session) {
    throw new UnauthorizedError();
  }
}
