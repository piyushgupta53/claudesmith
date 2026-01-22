/**
 * Array Utility Functions
 *
 * Common array operations used across stores for performance optimization.
 */

/**
 * Truncate an array to a maximum length using FIFO eviction.
 * Keeps the most recent (last) elements when array exceeds limit.
 *
 * @param array - The array to truncate
 * @param maxLength - Maximum number of elements to keep
 * @returns The truncated array (original array if within limit)
 *
 * @example
 * truncateToLimit([1, 2, 3, 4, 5], 3) // returns [3, 4, 5]
 * truncateToLimit([1, 2], 3)          // returns [1, 2]
 */
export function truncateToLimit<T>(array: T[], maxLength: number): T[] {
  if (array.length <= maxLength) {
    return array;
  }
  return array.slice(-maxLength);
}

/**
 * Add an item to an array and truncate if necessary.
 * Combines common pattern of adding + truncating in one operation.
 *
 * @param array - The original array
 * @param item - Item to add
 * @param maxLength - Maximum number of elements to keep
 * @returns New array with item added and truncated if needed
 *
 * @example
 * addAndTruncate([1, 2, 3], 4, 3) // returns [2, 3, 4]
 */
export function addAndTruncate<T>(array: T[], item: T, maxLength: number): T[] {
  const newArray = [...array, item];
  return truncateToLimit(newArray, maxLength);
}
