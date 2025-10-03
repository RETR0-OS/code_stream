/**
 * Hash generation utilities for session codes and cell IDs
 */

import { DEFAULTS } from '../models/types';

/**
 * Generate a random alphanumeric hash of specified length
 * @param length - Length of hash to generate (default: 6)
 * @returns Random alphanumeric string
 */
export function generateHash(length: number = DEFAULTS.HASH_LENGTH): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

/**
 * Generate a unique cell ID using UUID v4 format
 * @returns Unique cell identifier
 */
export function generateCellId(): string {
  // Simple UUID v4 implementation
  return 'cell_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate hash format (alphanumeric, specific length)
 * @param hash - Hash string to validate
 * @param length - Expected length (default: 6)
 * @returns True if valid, false otherwise
 */
export function validateHash(hash: string, length: number = DEFAULTS.HASH_LENGTH): boolean {
  if (!hash || hash.length !== length) {
    return false;
  }

  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(hash);
}

/**
 * Generate ISO timestamp string
 * @returns ISO 8601 formatted timestamp
 */
export function generateTimestamp(): string {
  return new Date().toISOString();
}
