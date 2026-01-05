// Stub file - TODO: Implement retry logic
export async function withRetry<T>(fn: () => Promise<T>, attempts: number = 3): Promise<T> {
  return fn();
}

export async function retry<T>(fn: () => Promise<T>, attempts: number = 3): Promise<T> {
  return withRetry(fn, attempts);
}
