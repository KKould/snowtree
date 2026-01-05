/**
 * Utility functions for timestamp handling in desktop package
 */

/**
 * Formats a timestamp for display to users
 * @param timestamp - The timestamp string from database or Date object
 * @returns Localized time string
 */
export function formatForDisplay(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString();
}

/**
 * Formats a date for database storage
 * @param date - The date to format (defaults to current date)
 * @returns ISO 8601 formatted string
 */
export function formatForDatabase(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Gets the current timestamp in ISO format for database storage
 * @returns ISO 8601 formatted string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
