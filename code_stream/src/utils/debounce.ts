/**
 * Debounce utility for delaying function execution
 */

/**
 * Creates a debounced function that delays invoking func until after
 * wait milliseconds have elapsed since the last time the debounced
 * function was invoked.
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per
 * every wait milliseconds.
 *
 * @param func - The function to throttle
 * @param wait - The number of milliseconds to throttle
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();

    if (now - lastCall >= wait) {
      lastCall = now;
      func(...args);
    }
  };
}
