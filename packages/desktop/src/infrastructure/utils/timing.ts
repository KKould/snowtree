// Stub file - TODO: Implement timing utilities
export function measureTime(label: string): () => void {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    console.log(`[${label}] ${duration}ms`);
  };
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T {
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}
